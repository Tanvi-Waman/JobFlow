const express = require("express");

const {
  createJob,
  getJobs,
  getJob,
  retryJob,
} = require("../controllers/jobController");

const router = express.Router();

router.post("/", createJob);

router.get("/", getJobs);

router.get("/:id/retry", retryJob);

router.get("/:id", getJob);

module.exports = router;
