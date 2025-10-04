const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

// Get LLM configuration from environment variables
const LLM_MODE = process.env.LLM_MODE || "mock"; // "mock" or "real"
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const LLM_MODEL = process.env.LLM_MODEL || "gpt-4";

/**
 * Call the LLM API with a prompt
 * @param {string} prompt - The prompt to send to the LLM
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function callLLMAPI(prompt) {
    try {
        const response = await axios.post(
            LLM_API_URL,
            {
                model: LLM_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${LLM_API_KEY}`,
                },
            }
        );

        if (response.data && response.data.choices && response.data.choices[0]) {
            return JSON.parse(response.data.choices[0].message.content);
        }

        throw new Error("Unexpected response format from LLM API");
    } catch (error) {
        console.error("Error calling LLM API:", error.response?.data || error.message);
        throw new Error("Failed to get response from LLM API");
    }
}

/**
 * Generate an interview question based on difficulty and context
 * @param {Object} params - Parameters for question generation
 * @param {string} params.candidateId - ID of the candidate
 * @param {string} params.difficulty - Question difficulty (easy, medium, hard)
 * @param {Array} params.previousQuestions - Previously asked questions
 * @param {string} params.resumeContext - Context from candidate's resume
 * @returns {Promise<Object>} - Generated question with metadata
 */
async function generateQuestion({ candidateId, difficulty, previousQuestions = [], resumeContext }) {
    // Use mock mode if configured or fallback
    if (LLM_MODE === "mock") {
        return getMockQuestion(candidateId, difficulty, previousQuestions);
    }

    // Prompt template for generating questions
    const prompt = `
As an AI interview assistant, generate ONE technical interview question for a candidate with the following parameters:
- Candidate Resume Context: "${resumeContext}"
- Question Difficulty Level: ${difficulty}
- Previous Questions: ${JSON.stringify(previousQuestions.map(q => q.qText || q))}

Respond with a JSON object in the following format only:
{
  "question": "your interview question here",
  "difficulty": "${difficulty}",
  "timeAllowedSec": number (90 for easy, 120 for medium, 180 for hard)
}

Do not include any explanations or other text outside the JSON object.
`;

    return await callLLMAPI(prompt);
}

/**
 * Score an answer to an interview question
 * @param {Object} params - Parameters for answer scoring
 * @param {string} params.candidateId - ID of the candidate
 * @param {string} params.question - The question that was asked
 * @param {string} params.answer - The candidate's answer
 * @param {string} params.difficulty - Question difficulty
 * @param {string} params.resumeContext - Context from candidate's resume
 * @returns {Promise<Object>} - Scoring results
 */
async function scoreAnswer({ candidateId, question, answer, difficulty, resumeContext }) {
    // Use mock mode if configured or fallback
    if (LLM_MODE === "mock") {
        return getMockScore(candidateId, answer, difficulty);
    }

    // Prompt template for scoring answers
    const prompt = `
As an AI interview assessor, evaluate the following candidate's answer to a technical interview question.

Question (${difficulty} difficulty): "${question}"
Answer: "${answer}"
Candidate Resume Context: "${resumeContext}"

Provide your evaluation as a JSON object only, with the following format:
{
  "score": number between 0-100,
  "breakdown": {
    "clarity": number between 0-100,
    "correctness": number between 0-100,
    "depth": number between 0-100
  },
  "feedback": "2-3 sentence constructive feedback on the answer"
}

Do not include any explanations or other text outside the JSON object.
`;

    return await callLLMAPI(prompt);
}

/**
 * Generate a summary of the interview
 * @param {Object} params - Parameters for summary generation
 * @param {string} params.candidateId - ID of the candidate
 * @param {Array} params.questions - All questions with answers and scores
 * @param {string} params.resumeContext - Context from candidate's resume
 * @returns {Promise<Object>} - Generated summary
 */
async function generateSummary({ candidateId, questions, finalScore, resumeContext }) {
    // Use mock mode if configured or fallback
    if (LLM_MODE === "mock") {
        return getMockSummary(candidateId, questions, finalScore);
    }

    // Prepare question history for the prompt
    const questionHistory = questions.map(q => ({
        question: q.qText,
        difficulty: q.difficulty,
        score: q.score
    }));

    // Prompt template for generating summary
    const prompt = `
As an AI interview assistant, generate a 2-4 sentence summary for a completed technical interview.

Candidate Resume Context: "${resumeContext}"
Question History: ${JSON.stringify(questionHistory)}
Final Score: ${finalScore}

Provide your summary as a JSON object only, with the following format:
{
  "summary": "2-4 sentence summary of the candidate's performance"
}

Do not include any explanations or other text outside the JSON object.
`;

    return await callLLMAPI(prompt);
}

/**
 * Get a mock question for testing
 * @param {string} candidateId - ID of the candidate
 * @param {string} difficulty - Question difficulty
 * @param {Array} previousQuestions - Previously asked questions
 * @returns {Object} - Mock question with metadata
 */
function getMockQuestion(candidateId, difficulty, previousQuestions = []) {
    // Predefined questions for each difficulty level
    const mockQuestions = {
        easy: [
            {
                question: "What is the difference between let, const, and var in JavaScript?",
                difficulty: "easy",
                timeAllowedSec: 90
            },
            {
                question: "Explain the concept of responsive web design.",
                difficulty: "easy",
                timeAllowedSec: 90
            },
            {
                question: "What are the main differences between HTTP and HTTPS?",
                difficulty: "easy",
                timeAllowedSec: 90
            }
        ],
        medium: [
            {
                question: "Explain the concept of closures in JavaScript and provide an example.",
                difficulty: "medium",
                timeAllowedSec: 120
            },
            {
                question: "What is the purpose of middleware in Express.js?",
                difficulty: "medium",
                timeAllowedSec: 120
            },
            {
                question: "Explain the differences between SQL and NoSQL databases.",
                difficulty: "medium",
                timeAllowedSec: 120
            }
        ],
        hard: [
            {
                question: "Design a scalable system for a real-time chat application that can support millions of users.",
                difficulty: "hard",
                timeAllowedSec: 180
            },
            {
                question: "Explain how you would implement a distributed rate limiter for a web API.",
                difficulty: "hard",
                timeAllowedSec: 180
            },
            {
                question: "Describe approaches to optimize database performance for a high-traffic web application.",
                difficulty: "hard",
                timeAllowedSec: 180
            }
        ]
    };

    // Get previously asked questions of this difficulty
    const previousQuestionsOfDifficulty = previousQuestions.filter(
        q => (q.difficulty || q) === difficulty
    ).length;

    // Select a question based on how many of this difficulty have been asked
    const questionIndex = previousQuestionsOfDifficulty % mockQuestions[difficulty].length;

    return mockQuestions[difficulty][questionIndex];
}

/**
 * Get a mock score for testing
 * @param {string} candidateId - ID of the candidate
 * @param {string} answer - The candidate's answer
 * @param {string} difficulty - Question difficulty
 * @returns {Object} - Mock scoring results
 */
function getMockScore(candidateId, answer, difficulty) {
    // Basic scoring logic based on answer length and difficulty
    let baseScore = 70; // Start with a decent score

    // Adjust based on answer length
    const wordCount = answer.split(/\s+/).length;

    if (difficulty === "easy" && wordCount >= 50) baseScore += 10;
    if (difficulty === "medium" && wordCount >= 100) baseScore += 10;
    if (difficulty === "hard" && wordCount >= 200) baseScore += 10;

    // Add some randomness but keep it deterministic for the same candidate and answer
    const seed = candidateId + answer.length;
    const randomOffset = (seed % 11) - 5; // -5 to +5 range

    let finalScore = Math.min(100, Math.max(0, baseScore + randomOffset));

    // Create more variation in the breakdown
    const clarityScore = Math.min(100, Math.max(0, finalScore - (seed % 7)));
    const correctnessScore = Math.min(100, Math.max(0, finalScore + (seed % 5)));
    const depthScore = Math.min(100, Math.max(0, finalScore - (seed % 10)));

    // Sample feedback based on score ranges
    let feedback;
    if (finalScore >= 85) {
        feedback = "Excellent response that demonstrates strong technical understanding. The explanation is clear, accurate, and shows good depth of knowledge.";
    } else if (finalScore >= 70) {
        feedback = "Good answer that covers the main points correctly. To improve, consider adding more specific examples and technical details.";
    } else if (finalScore >= 50) {
        feedback = "Satisfactory answer with some good points, but lacking depth. I recommend exploring the topic further and focusing on the underlying concepts.";
    } else {
        feedback = "The answer needs improvement in accuracy and depth. I suggest revisiting the fundamentals of this topic and practicing more concrete examples.";
    }

    return {
        score: Math.round(finalScore),
        breakdown: {
            clarity: Math.round(clarityScore),
            correctness: Math.round(correctnessScore),
            depth: Math.round(depthScore)
        },
        feedback
    };
}

/**
 * Get a mock summary for testing
 * @param {string} candidateId - ID of the candidate
 * @param {Array} questions - All questions with answers and scores
 * @param {number} finalScore - The final score
 * @returns {Object} - Mock summary
 */
function getMockSummary(candidateId, questions, finalScore) {
    let summary;

    if (finalScore >= 85) {
        summary = "The candidate demonstrated excellent technical knowledge across all difficulty levels. Their answers were clear, well-structured, and showed deep understanding of the concepts. This candidate would be a strong technical fit for the role.";
    } else if (finalScore >= 70) {
        summary = "The candidate showed good technical competence, particularly in the core concepts. They provided solid answers to most questions, though some of the harder questions could have been explored in more depth. Overall, a promising candidate with good potential.";
    } else if (finalScore >= 50) {
        summary = "The candidate displayed adequate understanding of basic concepts but struggled with more complex topics. Their answers were generally on the right track but lacked depth and technical precision. Additional technical training would be beneficial.";
    } else {
        summary = "The candidate had difficulty articulating clear answers to many of the technical questions. There were significant gaps in knowledge that would make it challenging to perform effectively in this role without substantial additional training.";
    }

    return { summary };
}

// Export functions and allow setting mode for testing
module.exports = {
    generateQuestion,
    scoreAnswer,
    generateSummary,
    setMode: (mode) => {
        LLM_MODE = mode;
    }
};
