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

  const totalAttempts = job.opts.attempts || 1;
  const currentAttempt = job.attemptsMade + 1;
  const isFinalAttempt = currentAttempt >= totalAttempts;

  console.log("-----------------------------------");
  console.log(`Job ID: ${jobId}`);
  console.log(`Type: ${type}`);
  console.log(`Attempt: ${currentAttempt}/${totalAttempts}`);

  try {
    // Mark the job as processing.
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "processing",
        startedAt: new Date(),
        completedAt: null,
        failedAt: null,
        attempts: currentAttempt,
        errorMessage: null,
      },
    });

    // Process supported job types.
    if (type === "email") {
      if (!payload || !payload.to) {
        throw new Error("Email recipient is required");
      }

      console.log(`Simulating email to: ${payload.to}`);

      // Simulate background work.
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Email simulation completed");
    } else {
      throw new Error(`Unsupported job type: ${type}`);
    }

    // Save successful completion.
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
    console.error(`Job attempt failed: ${jobId}`);
    console.error(error.message);

    // Intermediate failures can be retried by BullMQ.
    // The last failed attempt should remain failed.
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: isFinalAttempt ? "failed" : "queued",
          failedAt: isFinalAttempt ? new Date() : null,
          completedAt: null,
          attempts: currentAttempt,
          errorMessage: error.message,
        },
      });
    } catch (dbError) {
      console.error("Could not update job status:", dbError.message);
    }

    // Important: rethrow so BullMQ can perform its retry logic.
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

  // Ensure the database shows the final failure after all retries.
  if (job.attemptsMade >= totalAttempts) {
    try {
      await prisma.job.update({
        where: { id: job.data.jobId },
        data: {
          status: "failed",
          failedAt: new Date(),
          completedAt: null,
          attempts: job.attemptsMade,
          errorMessage: error.message,
        },
      });

      console.log(`Final failure saved: ${job.data.jobId}`);
    } catch (dbError) {
      console.error("Failed to save final status:", dbError.message);
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

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
