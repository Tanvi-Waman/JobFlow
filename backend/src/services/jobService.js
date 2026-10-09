const prisma = require("../config/database");

async function createJob(data) {
  const job = await prisma.job.create({
    data: {
      type: data.type,
      priority: data.priority || "normal",
      payload: data.payload,
      maxAttempts: data.maxAttempts || 3,
    },
  });

  return job;
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
