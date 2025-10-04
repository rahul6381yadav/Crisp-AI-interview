const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extract text from PDF files
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error("Error extracting text from PDF:", error);

        // For unreadable PDFs, we could implement OCR fallback here
        // const textFromOCR = await extractWithOCR(filePath);
        // return textFromOCR;

        throw new Error("Failed to extract text from PDF");
    }
}

/**
 * Extract text from DOCX files
 * @param {string} filePath - Path to DOCX file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDOCX(filePath) {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    } catch (error) {
        console.error("Error extracting text from DOCX:", error);
        throw new Error("Failed to extract text from DOCX");
    }
}

/**
 * OCR fallback for scanned PDFs using Tesseract
 * This is optional and can be implemented if needed
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Extracted text using OCR
 */
async function extractWithOCR(filePath) {
    // This would require the tesseract.js library
    // const { createWorker } = require('tesseract.js');
    // const worker = await createWorker('eng');
    // const { data } = await worker.recognize(filePath);
    // await worker.terminate();
    // return data.text;

    // For now we'll just return this message
    return "OCR extraction not implemented. Install tesseract.js to enable this feature.";
}

/**
 * Extract candidate information from text using regexes
 * @param {string} text - Text extracted from resume
 * @returns {Object} - Extracted information and missing fields
 */
function extractCandidateInfo(text) {
    const info = {
        name: null,
        email: null,
        phone: null,
        missingFields: []
    };

    // Email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) {
        info.email = emailMatch[0];
    } else {
        info.missingFields.push("email");
    }

    // Phone extraction
    const phoneRegex = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
        info.phone = phoneMatch[0];
    } else {
        info.missingFields.push("phone");
    }

    // Name extraction (this is trickier, often at the beginning of resume)
    // Simple heuristic: Look for capitalized words at the beginning
    const lines = text.split("\n").slice(0, 5); // Check first 5 lines
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(trimmedLine)) {
            info.name = trimmedLine;
            break;
        }
    }

    if (!info.name) {
        info.missingFields.push("name");
    }

    return info;
}

/**
 * Main function to extract text from resume file
 * @param {string} filePath - Path to resume file
 * @param {string} mimeType - MIME type of file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromResume(filePath, mimeType) {
    if (mimeType === "application/pdf") {
        return await extractTextFromPDF(filePath);
    } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "application/msword"
    ) {
        return await extractTextFromDOCX(filePath);
    } else {
        throw new Error("Unsupported file format");
    }
}

module.exports = {
    extractTextFromResume,
    extractCandidateInfo
};
