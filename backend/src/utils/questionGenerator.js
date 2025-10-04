const dotenv = require("dotenv");
dotenv.config();
const OpenAI = require("openai");
const Interview = require("../models/Interview");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateQuestions() {
    const prompt = `
Generate 6 full stack interview questions for a candidate skilled in React, Node, MongoDB.
2 Easy, 2 Medium, 2 Hard.
Return JSON: [{text:"", difficulty:"", timeLimitSec:0}]
  `;
    const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
    });
    return JSON.parse(res.choices[0].message.content);
}

async function saveGeneratedQuestions(interviewId, questions) {
    try {
        const interview = await Interview.findById(interviewId);
        if (!interview) {
            throw new Error("Interview not found");
        }
        interview.questions = questions;
        await interview.save();
        return interview;
    } catch (error) {
        console.error("Error saving questions:", error);
        throw error;
    }
}

module.exports = { generateQuestions, saveGeneratedQuestions };