const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    resumeFile: {
        path: { type: String, required: true },
        originalName: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        extractedText: { type: String }
    },
    status: {
        type: String,
        enum: ["not_started", "in_progress", "paused", "completed"],
        default: "not_started"
    },
    currentQuestionIndex: {
        type: Number,
        default: -1 // -1 means interview hasn't started yet
    },
    remainingTimeSec: {
        type: Number,
        default: 0
    },
    pausedAt: {
        type: Date
    },
    questions: [{
        qText: { type: String, required: true },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            required: true
        },
        timeAllowedSec: { type: Number, required: true },
        answer: { type: String },
        answeredAt: { type: Date },
        timeTakenSec: { type: Number },
        autoSubmitted: { type: Boolean, default: false },
        score: { type: Number },
        breakdown: {
            clarity: { type: Number },
            correctness: { type: Number },
            depth: { type: Number }
        },
        feedback: { type: String }
    }],
    finalScore: { type: Number },
    summary: { type: String },
    missingFields: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model("Candidate", candidateSchema);
