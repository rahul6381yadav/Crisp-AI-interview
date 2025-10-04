const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const Candidate = require("../models/Candidate");
const { setMode } = require("../utils/llmWrapper");
const path = require("path");
const fs = require("fs");

// Set LLM wrapper to mock mode for tests
setMode("mock");

// Create test directory and sample files if needed
const testDir = path.join(__dirname, "fixtures");
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
}

// Create a sample PDF for testing if it doesn't exist
const samplePdfPath = path.join(testDir, "sample-resume.pdf");
if (!fs.existsSync(samplePdfPath)) {
    // This is a placeholder - in a real test, you'd have actual test PDFs
    fs.writeFileSync(samplePdfPath, "%PDF-1.5\nThis is a test PDF file");
}

describe("Candidate API Integration Tests", () => {
    beforeAll(async () => {
        // Connect to test database
        const mongoUri = process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/interview-assistant-test";
        await mongoose.connect(mongoUri);
    });

    beforeEach(async () => {
        // Clear the database before each test
        await Candidate.deleteMany({});
    });

    afterAll(async () => {
        // Disconnect after all tests
        await mongoose.connection.close();
    });

    describe("POST /api/candidates", () => {
        it("should create a new candidate with resume upload", async () => {
            const response = await request(app)
                .post("/api/candidates")
                .attach("resume", samplePdfPath)
                .expect(201);

            expect(response.body.candidate).toHaveProperty("id");
            expect(response.body.candidate).toHaveProperty("missingFields");
        });

        it("should reject requests without resume file", async () => {
            const response = await request(app)
                .post("/api/candidates")
                .expect(400);

            expect(response.body).toHaveProperty("error");
        });
    });

    describe("Full Interview Flow", () => {
        it("should handle a complete interview flow", async () => {
            // Step 1: Create candidate
            const createResponse = await request(app)
                .post("/api/candidates")
                .attach("resume", samplePdfPath)
                .expect(201);

            const candidateId = createResponse.body.candidate.id;

            // Step 2: Update missing fields if any
            if (createResponse.body.candidate.missingFields.length > 0) {
                await request(app)
                    .patch(`/api/candidates/${candidateId}/fields`)
                    .send({
                        name: "Test Candidate",
                        email: "test@example.com",
                        phone: "(555) 123-4567"
                    })
                    .expect(200);
            }

            // Step 3: Start interview
            const startResponse = await request(app)
                .post(`/api/candidates/${candidateId}/start`)
                .expect(200);

            expect(startResponse.body).toHaveProperty("status", "in_progress");
            expect(startResponse.body).toHaveProperty("currentQuestion");

            // Step 4: Submit answers for all 6 questions
            let currentStatus = "in_progress";
            let nextQuestion = startResponse.body.currentQuestion;

            while (currentStatus === "in_progress") {
                const answerResponse = await request(app)
                    .post(`/api/candidates/${candidateId}/answer`)
                    .send({
                        answer: "This is a test answer that demonstrates understanding of the topic.",
                        timeTakenSec: Math.floor(nextQuestion.timeAllowedSec * 0.7), // Use 70% of allowed time
                        autoSubmitted: false
                    })
                    .expect(200);

                currentStatus = answerResponse.body.status;

                if (currentStatus === "in_progress") {
                    nextQuestion = answerResponse.body.nextQuestion;
                    expect(nextQuestion).toBeDefined();
                } else {
                    // Last question, should have final results
                    expect(answerResponse.body).toHaveProperty("finalScore");
                    expect(answerResponse.body).toHaveProperty("summary");
                }
            }

            // Step 5: Verify final candidate state
            const getResponse = await request(app)
                .get(`/api/candidates/${candidateId}`)
                .expect(200);

            expect(getResponse.body.candidate).toHaveProperty("status", "completed");
            expect(getResponse.body.candidate).toHaveProperty("finalScore");
            expect(getResponse.body.candidate).toHaveProperty("summary");
            expect(getResponse.body.candidate.questions.length).toBe(6);
        });

        it("should handle pause and resume functionality", async () => {
            // Create candidate
            const createResponse = await request(app)
                .post("/api/candidates")
                .attach("resume", samplePdfPath)
                .expect(201);

            const candidateId = createResponse.body.candidate.id;

            // Start interview
            await request(app)
                .post(`/api/candidates/${candidateId}/start`)
                .expect(200);

            // Pause interview
            const remainingTimeSec = 45;
            const pauseResponse = await request(app)
                .post(`/api/candidates/${candidateId}/pause`)
                .send({ remainingTimeSec })
                .expect(200);

            expect(pauseResponse.body).toHaveProperty("status", "paused");

            // Resume interview
            const resumeResponse = await request(app)
                .post(`/api/candidates/${candidateId}/resume`)
                .expect(200);

            expect(resumeResponse.body).toHaveProperty("status", "in_progress");
            expect(resumeResponse.body).toHaveProperty("remainingTimeSec", remainingTimeSec);
            expect(resumeResponse.body).toHaveProperty("currentQuestion");
        });
    });

    describe("GET /api/candidates", () => {
        beforeEach(async () => {
            // Create some test candidates
            await Candidate.create([
                {
                    name: "Alice Smith",
                    email: "alice@example.com",
                    phone: "(555) 111-2222",
                    resumeFile: {
                        path: "/fake/path/resume1.pdf",
                        originalName: "resume1.pdf",
                        mimeType: "application/pdf",
                        size: 12345
                    },
                    status: "completed",
                    finalScore: 85
                },
                {
                    name: "Bob Johnson",
                    email: "bob@example.com",
                    phone: "(555) 333-4444",
                    resumeFile: {
                        path: "/fake/path/resume2.pdf",
                        originalName: "resume2.pdf",
                        mimeType: "application/pdf",
                        size: 23456
                    },
                    status: "in_progress"
                },
                {
                    name: "Charlie Brown",
                    email: "charlie@example.com",
                    phone: "(555) 555-6666",
                    resumeFile: {
                        path: "/fake/path/resume3.pdf",
                        originalName: "resume3.pdf",
                        mimeType: "application/pdf",
                        size: 34567
                    },
                    status: "not_started"
                }
            ]);
        });

        it("should list all candidates with pagination", async () => {
            const response = await request(app)
                .get("/api/candidates")
                .expect(200);

            expect(response.body).toHaveProperty("candidates");
            expect(response.body.candidates.length).toBe(3);
            expect(response.body).toHaveProperty("pagination");
            expect(response.body.pagination).toHaveProperty("total", 3);
        });

        it("should support searching by name", async () => {
            const response = await request(app)
                .get("/api/candidates?search=Alice")
                .expect(200);

            expect(response.body.candidates.length).toBe(1);
            expect(response.body.candidates[0].name).toBe("Alice Smith");
        });

        it("should support sorting", async () => {
            const response = await request(app)
                .get("/api/candidates?sort=name&order=asc")
                .expect(200);

            expect(response.body.candidates[0].name).toBe("Alice Smith");
            expect(response.body.candidates[2].name).toBe("Charlie Brown");
        });
    });
});
