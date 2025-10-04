const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Candidate = require("../models/Candidate.js");
const { extractResumeData } = require("../utils/openaiHelper.js");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

exports.uploadResume = [
    upload.single("resume"),
    async (req, res) => {
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        let text = "";
        if (file.mimetype === "application/pdf") {
            const data = await pdfParse(fs.readFileSync(file.path));
            text = data.text;
        } else {
            const result = await mammoth.extractRawText({ buffer: fs.readFileSync(file.path) });
            text = result.value;
        }

        const extracted = await extractResumeData(text);
        console.log("Extracted Data:", extracted);

        const candidate = await Candidate.create({
            name: extracted.name || "",
            email: extracted.email || "",
            phone: extracted.phone || "",
            resumePath: file.path,
        });

        res.json({
            candidate,
            missingFields: {
                name: !extracted.name,
                email: !extracted.email,
                phone: !extracted.phone,
            },
        });
    },
];
