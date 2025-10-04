async function generateSummary(interviewData) {
    const prompt = `
Summarize candidate performance in 2–3 sentences.
Return JSON: {finalScore: number, summary: string}
Data: ${JSON.stringify(interviewData)}
  `;
    const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
    });
    return JSON.parse(res.choices[0].message.content);
}

module.exports = { generateSummary };
