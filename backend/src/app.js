const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db.js");

const authRoutes = require("./routes/authRoutes.js");
const resumeRoutes = require("./routes/resumeRoutes.js");
const interviewRoutes = require("./routes/interviewRoutes.js");
const candidateRoutes = require("./routes/candidateRoutes.js");

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/health", (req, res) => res.status(200).json({ status: "ok", version: "1.0.0" }));

module.exports = app;
