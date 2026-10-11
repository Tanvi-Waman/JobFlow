jest.mock("../src/services/jobService", () => ({
  createJob: jest.fn(),
  getAllJobs: jest.fn(),
  getJobById: jest.fn(),
  retryJob: jest.fn(),
}));

const request = require("supertest");
const app = require("../src/server");
const jobService = require("../src/services/jobService");

describe("JobFlow API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /health returns healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "healthy" });
  });

  test("POST /api/jobs creates a job", async () => {
    const mockJob = {
      id: "job-test-1",
      type: "email",
      status: "queued",
      payload: { to: "test@example.com" },
    };

    jobService.createJob.mockResolvedValue(mockJob);

    const response = await request(app)
      .post("/api/jobs")
      .send({
        type: "email",
        payload: { to: "test@example.com" },
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("job-test-1");
    expect(jobService.createJob).toHaveBeenCalledWith({
      type: "email",
      payload: { to: "test@example.com" },
      priority: undefined,
      maxAttempts: undefined,
    });
  });

  test("POST /api/jobs rejects a missing job type", async () => {
    const response = await request(app)
      .post("/api/jobs")
      .send({
        payload: { to: "test@example.com" },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Job type is required");
    expect(jobService.createJob).not.toHaveBeenCalled();
  });

  test("POST /api/jobs rejects a missing payload", async () => {
    const response = await request(app)
      .post("/api/jobs")
      .send({ type: "email" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Job payload is required");
    expect(jobService.createJob).not.toHaveBeenCalled();
  });

  test("GET /api/jobs returns all jobs", async () => {
    jobService.getAllJobs.mockResolvedValue([
      { id: "job-1", type: "email", status: "completed" },
    ]);

    const response = await request(app).get("/api/jobs");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("job-1");
  });

  test("GET /api/jobs/:id returns 404 for a missing job", async () => {
    jobService.getJobById.mockResolvedValue(null);

    const response = await request(app).get("/api/jobs/missing-id");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Job not found");
  });

  test("POST /api/jobs/:id/retry retries a failed job", async () => {
    jobService.retryJob.mockResolvedValue({
      id: "job-failed-1",
      type: "email",
      status: "queued",
    });

    const response = await request(app).post("/api/jobs/job-failed-1/retry");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("queued");
    expect(jobService.retryJob).toHaveBeenCalledWith("job-failed-1");
  });

  test("POST /api/jobs/:id/retry returns 404 for a missing job", async () => {
    const error = new Error("Job not found");
    error.statusCode = 404;
    jobService.retryJob.mockRejectedValue(error);

    const response = await request(app).post("/api/jobs/missing-id/retry");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Job not found");
  });
});
