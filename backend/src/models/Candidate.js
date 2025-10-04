const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    resumePath: String,
    status: { type: String, default: "incomplete" },
});

module.exports = mongoose.model("Candidate", candidateSchema);
