const prisma = require("../config/database");
const jobQueue = require("../queues/jobQueue");

const STALE_AFTER_MS = 5 * 60 * 1000;

function getQueuePriority(priority) {
  if (priority === "high") return 1;
  if (priority === "low") return 10;
  return 5;
}

async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const staleJobs = await prisma.job.findMany({
    where: {
      status: "processing",
      startedAt: { lt: cutoff },
    },
  });

  for (const job of staleJobs) {
    try {
      if (job.attempts >= job.maxAttempts) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: "failed",
            failedAt: new Date(),
            errorMessage:
              job.errorMessage || "Worker stopped before job completion",
          },
        });

        console.log(`Marked exhausted stale job as failed: ${job.id}`);
        continue;
      }

      // Requeue the job with the remaining attempt budget.
      await jobQueue.add(
        job.type,
        {
          jobId: job.id,
          type: job.type,
          payload: job.payload,
        },
        {
          // This is the remaining budget, not a fresh full retry budget.
          attempts: job.maxAttempts - job.attempts,
          backoff: { type: "exponential", delay: 1000 },
          priority: getQueuePriority(job.priority),
          removeOnComplete: 100,
          removeOnFail: false,
        },
      );

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "queued",
          startedAt: null,
          completedAt: null,
          failedAt: null,
          errorMessage: null,
        },
      });

      console.log(`Requeued stale job: ${job.id}`);
    } catch (error) {
      console.error(`Could not recover job ${job.id}:`, error.message);
    }
  }

  return staleJobs.length;
}

module.exports = { recoverStaleJobs };
