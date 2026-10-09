const jobService = require("../services/jobService");

async function createJob(req, res) {
  try {
    const { type, payload, priority, maxAttempts } = req.body;

    if (!type) {
      return res.status(400).json({
        error: "Job Type is required",
      });
    }

    if (!payload) {
      return res.status(400).json({
        error: "Job payload is required",
      });
    }

    const job = await jobService.createJob({
      type,
      payload,
      priority,
      maxAttempts,
    });

    res.status(201).json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create job",
    });
  }
}

async function getJobs(req, res) {
  try {
    const jobs = await jobService.getAllJobs();

    res.json(jobs);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch jobs",
    });
  }
}

async function getJob(req, res) {
  try {
    const job = await jobService.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
      });
    }

    res.json(job);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch jobs",
    });
  }
}

module.exports = {
  createJob,
  getJobs,
  getJob,
};
