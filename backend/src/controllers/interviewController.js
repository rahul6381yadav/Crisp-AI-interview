const Candidate = require("../models/Candidate.js");
const Interview = require("../models/Interview.js");
const { generateQuestions } = require("../utils/questionGenerator.js");
const { evaluateAnswer } = require("../utils/answerEvaluator.js");
const { generateSummary } = require("../utils/summaryGenerator.js");

const startInterview = async (req, res) => {
    const { candidateId } = req.body;
    const candidate = await Candidate.findById(candidateId);
    const questions = await generateQuestions(candidate);
    const interview = await Interview.create({ candidateId, questions });
    res.json(interview);
};

const submitAnswer = async (req, res) => {
    const { interviewId, index, answer } = req.body;
    const interview = await Interview.findById(interviewId);
    const question = interview.questions[index].text;
    const result = await evaluateAnswer(question, answer);

    interview.questions[index].answer = answer;
    interview.questions[index].score = result.score;
    interview.questions[index].feedback = result.feedback;
    await interview.save();

    const io = req.app.get("io");
    io.to("interviewer-dashboard").emit("candidate_update", interview);

    res.json(result);
};

const finalizeInterview = async (req, res) => {
    const { interviewId } = req.body;
    const interview = await Interview.findById(interviewId);
    const summary = await generateSummary(interview);
    interview.finalScore = summary.finalScore;
    interview.summary = summary.summary;
    interview.status = "completed";
    await interview.save();

    const io = req.app.get("io");
    io.to("interviewer-dashboard").emit("interview_complete", interview);

    res.json(interview);
};

module.exports = { startInterview, submitAnswer, finalizeInterview };
