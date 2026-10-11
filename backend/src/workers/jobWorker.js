require("dotenv").config();

const { Worker } = require("bullmq");
const prisma = require("../config/database");

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
};

async function processJob(job) {
  const { jobId, type, payload } = job.data;

  console.log(`Starting job: ${jobId}`);
  console.log(`Job type: ${type}`);
  console.log(`Attempt: ${job.attemptsMade + 1}`);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "processing",
      startedAt: new Date(),
      errorMessage: null,
      attempts: { increment: 1 },
    },
  });

  try {
    if (type === "email") {
      if (!payload || !payload.to) {
        throw new Error("Email recipient is required");
      }

      console.log(`Simulating email to: ${payload.to}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Email simulation completed");
    } else {
      throw new Error(`Unsupported job type: ${type}`);
    }

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        failedAt: null,
        errorMessage: null,
      },
    });

    console.log(`Job completed: ${jobId}`);

    return { success: true, jobId };
  } catch (error) {
    const totalAttempts = job.opts.attempts || 1;
    const finalAttempt = job.attemptsMade + 1 >= totalAttempts;

    console.error(`Job attempt failed: ${jobId}`, error.message);

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: finalAttempt ? "failed" : "queued",
        failedAt: finalAttempt ? new Date() : null,
        errorMessage: error.message,
      },
    });

    throw error;
  }
}

const worker = new Worker("jobflow-queue", processJob, {
  connection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`BullMQ job ${job.id} completed successfully`);
});

worker.on("failed", async (job, error) => {
  console.error(`BullMQ job ${job?.id} failed: ${error.message}`);

  if (!job) return;

  const totalAttempts = job.opts.attempts || 1;

  if (job.attemptsMade >= totalAttempts) {
    try {
      await prisma.job.update({
        where: { id: job.data.jobId },
        data: {
          status: "failed",
          failedAt: new Date(),
          errorMessage: error.message,
        },
      });

      console.log(`Database status set to failed: ${job.data.jobId}`);
    } catch (dbError) {
      console.error("Failed to update final job status:", dbError);
    }
  }
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

console.log("JobFlow worker is listening for jobs...");

async function shutdown() {
  console.log("Shutting down worker...");

  await worker.close();
  await prisma.$disconnect();

  process.exit(0);
}
