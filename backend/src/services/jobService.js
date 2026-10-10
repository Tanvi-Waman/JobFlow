const prisma = require("../config/database");
const jobQueue = require("../queues/jobQueue");

function getQueuePriority(priority) {
  if (priority === "high") return 1;
  if (priority === "low") return 10;
  return 5;
}

async function createJob(data) {
  const job = await prisma.job.create({
    data: {
      type: data.type,
      priority: data.priority || "normal",
      payload: data.payload,
      maxAttempts: data.maxAttempts || 3,
    },
  });

  try {
    await jobQueue.add(
      job.type,
      {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
      },
      {
        attempts: job.maxAttempts,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        priority: job.priority === "high" ? 1 : job.priority === "low" ? 10 : 5,
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return job;
  } catch (error) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorMessage: `Queueing failed: ${error.message}`,
      },
    });

    throw error;
  }
}

async function getAllJobs() {
  return prisma.job.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getJobById(id) {
  return prisma.job.findUnique({
    where: {
      id,
    },
  });
}

async function retryJob(id) {
  const job = await prisma.job.findUnique({
    where: { id },
  });

  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  if (job.status !== "failed") {
    const error = new Error("Only failed jobs can be retried");
    error.statusCode = 409;
    throw error;
  }

  await prisma.job.update({
    where: { id },
    data: {
      status: "queued",
      attempts: 0,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      errorMessage: null,
    },
  });

  try {
    await jobQueue.add(
      job.type,
      {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
      },
      {
        attempts: job.maxAttempts,
        backoff: { type: "exponential", delay: 1000 },
        priority: getQueuePriority(job.priority),
        removeOnComplete: 100,
        removeOnFail: false,
      },
    );

    return await getJobById(id);
  } catch (error) {
    await prisma.job.update({
      where: { id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorMessage: `Retry queueing failed: ${error.message}`,
      },
    });

    throw error;
  }
}

module.exports = { createJob, getAllJobs, getJobById, retryJob };
