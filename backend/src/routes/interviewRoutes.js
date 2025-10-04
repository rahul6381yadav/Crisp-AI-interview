const express = require("express");
const { startInterview, submitAnswer, finalizeInterview } = require("../controllers/interviewController.js");
const router = express.Router();

router.post("/start", startInterview);
router.post("/answer", submitAnswer);
router.post("/finalize", finalizeInterview);

module.exports = router;
