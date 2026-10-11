const express = require("express");

const jobRoutes = require("./routes/jobRoutes");

const app = express();

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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`JobFlow API running on https://localhost:${PORT}`);
  });
}

module.exports = app;
