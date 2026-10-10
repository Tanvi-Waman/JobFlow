const prisma = require("../config/database");
const jobQueue = require("../queues/jobQueue");

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

module.exports = { createJob, getAllJobs, getJobById };
