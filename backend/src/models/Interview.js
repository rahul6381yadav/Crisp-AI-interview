const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate" },
    questions: [{ text: String, difficulty: String, timeLimitSec: Number, answer: String, score: Number, feedback: String }],
    finalScore: Number,
    summary: String,
    status: { type: String, default: "ongoing" },
});

module.exports = mongoose.model("Interview", interviewSchema);
