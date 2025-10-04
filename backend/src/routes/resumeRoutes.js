const express = require("express");
const { uploadResume } = require("../controllers/resumeController.js");
const router = express.Router();
router.post("/upload", uploadResume);
module.exports = router;
