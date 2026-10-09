const express = require("express");

const { createJob, getJobs, getJob } = require("../controllers/jobController");

const router = express.Router();

router.post("/", createJob);

router.get("/", getJobs);

router.get("/:id", getJob);

module.exports = router;
