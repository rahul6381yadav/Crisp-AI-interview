async function evaluateAnswer(question, answer) {
    const prompt = `
Grade this answer out of 10 and give short feedback.
Return JSON: {score: number, feedback: string}
Q: ${question}
A: ${answer}
  `;
    const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
    });
    return JSON.parse(res.choices[0].message.content);
}

module.exports = { evaluateAnswer };
