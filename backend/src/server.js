const express = require("express");

const jobRoutes = require("./routes/jobRoutes");

const app = express();

const PORT = 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "JobFlow API is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
  });
});

app.use("/api/jobs", jobRoutes);

app.listen(PORT, () => {
  console.log(`JobFlow API running on http://localhost:${PORT}`);
});
