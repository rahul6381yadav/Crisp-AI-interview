const dotenv = require("dotenv");
dotenv.config();
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractResumeData(resumeText) {
    const prompt = `
Extract the following details in JSON:
{name:"", email:"", phone:""}.
Text: ${resumeText}
  `;
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
    });
    const content = response.choices[0].message.content;
    try {
        return JSON.parse(content);
    } catch {
        return { name: "", email: "", phone: "" };
    }

}
module.exports = { extractResumeData };
