const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Candidate = require("../models/Candidate");
const { extractTextFromResume, extractCandidateInfo } = require("../utils/resumeParser");
const { generateQuestion, scoreAnswer, generateSummary } = require("../utils/llmWrapper");

// Configure multer storage for resume uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, "../../../uploads/resumes");

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp and original name
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `resume-${uniqueSuffix}${ext}`);
    }
});

// File filter for resume uploads
const fileFilter = (req, file, cb) => {
    // Accept only PDF and DOCX
    if (
        file.mimetype === "application/pdf" ||
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.mimetype === "application/msword"
    ) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF and DOCX files are allowed"), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max file size
});

/**
 * Create new candidate
 * POST /api/candidates
 */
router.post("/", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Resume file is required" });
        }

        const filePath = req.file.path;
        const extractedText = await extractTextFromResume(filePath, req.file.mimetype);
        const candidateInfo = extractCandidateInfo(extractedText);

        const candidate = new Candidate({
            name: candidateInfo.name,
            email: candidateInfo.email,
            phone: candidateInfo.phone,
            resumeFile: {
                path: filePath,
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size,
                extractedText
            },
            missingFields: candidateInfo.missingFields,
            status: "not_started"
        });

        await candidate.save();

        res.status(201).json({
            candidate: {
                id: candidate._id,
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
                missingFields: candidate.missingFields,
                status: candidate.status,
                createdAt: candidate.createdAt
            }
        });
    } catch (error) {
        console.error("Error creating candidate:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update candidate fields
 * PATCH /api/candidates/:id/fields
 */
router.patch("/:id/fields", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone } = req.body;

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        // Update provided fields
        if (name !== undefined) candidate.name = name;
        if (email !== undefined) candidate.email = email;
        if (phone !== undefined) candidate.phone = phone;

        // Update missing fields array
        candidate.missingFields = [];
        if (!candidate.name) candidate.missingFields.push("name");
        if (!candidate.email) candidate.missingFields.push("email");
        if (!candidate.phone) candidate.missingFields.push("phone");

        await candidate.save();

        res.json({
            candidate: {
                id: candidate._id,
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
                missingFields: candidate.missingFields,
                status: candidate.status,
                updatedAt: candidate.updatedAt
            }
        });
    } catch (error) {
        console.error("Error updating candidate fields:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Start interview
 * POST /api/candidates/:id/start
 */
router.post("/:id/start", async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        if (candidate.status === "in_progress") {
            return res.status(400).json({ error: "Interview already in progress" });
        }

        if (candidate.status === "completed") {
            return res.status(400).json({ error: "Interview already completed" });
        }

        // Generate first question (always easy difficulty)
        const resumeContext = candidate.resumeFile.extractedText.substring(0, 500); // Limit context size
        const question = await generateQuestion({
            candidateId: candidate._id.toString(),
            difficulty: "easy",
            previousQuestions: [],
            resumeContext
        });

        // Reset interview state
        candidate.questions = [{
            qText: question.question,
            difficulty: question.difficulty,
            timeAllowedSec: question.timeAllowedSec
        }];

        candidate.currentQuestionIndex = 0;
        candidate.status = "in_progress";
        candidate.pausedAt = null;
        candidate.finalScore = null;
        candidate.summary = null;

        await candidate.save();

        res.json({
            status: "in_progress",
            currentQuestion: {
                question: question.question,
                difficulty: question.difficulty,
                timeAllowedSec: question.timeAllowedSec
            },
            totalQuestions: 6 // 2 easy, 2 medium, 2 hard
        });
    } catch (error) {
        console.error("Error starting interview:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Submit answer
 * POST /api/candidates/:id/answer
 */
router.post("/:id/answer", async (req, res) => {
    try {
        const { id } = req.params;
        const { answer, timeTakenSec, autoSubmitted = false } = req.body;

        if (!answer && !autoSubmitted) {
            return res.status(400).json({ error: "Answer is required" });
        }

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        if (candidate.status !== "in_progress") {
            return res.status(400).json({ error: "No active interview in progress" });
        }

        const currentIndex = candidate.currentQuestionIndex;
        if (currentIndex >= candidate.questions.length) {
            return res.status(400).json({ error: "No current question to answer" });
        }

        const currentQuestion = candidate.questions[currentIndex];
        const autoSubmit = autoSubmitted || timeTakenSec >= currentQuestion.timeAllowedSec;

        // Score the answer
        const resumeContext = candidate.resumeFile.extractedText.substring(0, 500);
        const scoringResult = await scoreAnswer({
            candidateId: candidate._id.toString(),
            question: currentQuestion.qText,
            answer,
            difficulty: currentQuestion.difficulty,
            resumeContext
        });

        // Update current question with answer and score
        currentQuestion.answer = answer;
        currentQuestion.answeredAt = new Date();
        currentQuestion.timeTakenSec = timeTakenSec;
        currentQuestion.autoSubmitted = autoSubmit;
        currentQuestion.score = scoringResult.score;
        currentQuestion.breakdown = scoringResult.breakdown;
        currentQuestion.feedback = scoringResult.feedback;

        // Check if this was the last question (6 questions total)
        const isLastQuestion = currentIndex === 5;

        if (isLastQuestion) {
            // Calculate final score (average of all question scores)
            const totalScore = candidate.questions.reduce((sum, q) => sum + q.score, 0);
            const finalScore = Math.round(totalScore / candidate.questions.length);

            // Generate interview summary
            const summaryResult = await generateSummary({
                candidateId: candidate._id.toString(),
                questions: candidate.questions,
                finalScore,
                resumeContext
            });

            candidate.finalScore = finalScore;
            candidate.summary = summaryResult.summary;
            candidate.status = "completed";

            await candidate.save();

            return res.json({
                status: "completed",
                questionFeedback: scoringResult,
                finalScore,
                summary: summaryResult.summary
            });
        } else {
            // Generate next question
            // Logic: 2 easy (index 0-1), 2 medium (index 2-3), 2 hard (index 4-5)
            let nextDifficulty;
            if (currentIndex < 1) {
                nextDifficulty = "easy";
            } else if (currentIndex < 3) {
                nextDifficulty = "medium";
            } else {
                nextDifficulty = "hard";
            }

            const nextQuestion = await generateQuestion({
                candidateId: candidate._id.toString(),
                difficulty: nextDifficulty,
                previousQuestions: candidate.questions,
                resumeContext
            });

            // Add next question to the list
            candidate.questions.push({
                qText: nextQuestion.question,
                difficulty: nextQuestion.difficulty,
                timeAllowedSec: nextQuestion.timeAllowedSec
            });

            // Move to next question
            candidate.currentQuestionIndex += 1;

            await candidate.save();

            return res.json({
                status: "in_progress",
                questionFeedback: scoringResult,
                nextQuestion: {
                    question: nextQuestion.question,
                    difficulty: nextQuestion.difficulty,
                    timeAllowedSec: nextQuestion.timeAllowedSec
                }
            });
        }
    } catch (error) {
        console.error("Error submitting answer:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Pause interview
 * POST /api/candidates/:id/pause
 */
router.post("/:id/pause", async (req, res) => {
    try {
        const { id } = req.params;
        const { remainingTimeSec } = req.body;

        if (remainingTimeSec === undefined) {
            return res.status(400).json({ error: "remainingTimeSec is required" });
        }

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        if (candidate.status !== "in_progress") {
            return res.status(400).json({ error: "No active interview to pause" });
        }

        candidate.status = "paused";
        candidate.remainingTimeSec = remainingTimeSec;
        candidate.pausedAt = new Date();

        await candidate.save();

        res.json({
            status: "paused",
            message: "Interview paused successfully"
        });
    } catch (error) {
        console.error("Error pausing interview:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Resume interview
 * POST /api/candidates/:id/resume
 */
router.post("/:id/resume", async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        if (candidate.status !== "paused") {
            return res.status(400).json({ error: "Interview is not paused" });
        }

        candidate.status = "in_progress";

        // Get current question
        const currentQuestion = candidate.questions[candidate.currentQuestionIndex];

        await candidate.save();

        res.json({
            status: "in_progress",
            currentQuestion: {
                question: currentQuestion.qText,
                difficulty: currentQuestion.difficulty,
                timeAllowedSec: currentQuestion.timeAllowedSec
            },
            remainingTimeSec: candidate.remainingTimeSec
        });
    } catch (error) {
        console.error("Error resuming interview:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * List all candidates
 * GET /api/candidates
 */
router.get("/", async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sort = "createdAt",
            order = "desc",
            search = ""
        } = req.query;

        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        // Build query
        let query = {};

        // Add search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        // Sort order
        const sortOrder = order === "asc" ? 1 : -1;
        const sortOption = {};
        sortOption[sort] = sortOrder;

        // Execute query with pagination
        const candidates = await Candidate.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNumber)
            .select("name email phone status finalScore createdAt updatedAt");

        // Get total count for pagination
        const total = await Candidate.countDocuments(query);

        res.json({
            candidates,
            pagination: {
                total,
                page: pageNumber,
                limit: limitNumber,
                pages: Math.ceil(total / limitNumber)
            }
        });
    } catch (error) {
        console.error("Error listing candidates:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get candidate details
 * GET /api/candidates/:id
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findById(id);
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        // Don't return the full extracted text to reduce payload size
        const candidateObj = candidate.toObject();
        if (candidateObj.resumeFile && candidateObj.resumeFile.extractedText) {
            candidateObj.resumeFile.extractedText = candidateObj.resumeFile.extractedText.substring(0, 500) + "...";
        }

        res.json({ candidate: candidateObj });
    } catch (error) {
        console.error("Error getting candidate details:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
