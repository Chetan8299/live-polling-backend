import Poll from "../models/poll.model.js";

export const calculateResults = async (pollId) => {
    const poll = await Poll.findById(pollId);
    if (!poll) return null;

    // count responses
    const counts = {};
    poll.options.forEach((opt) => (counts[opt.text] = 0));
    poll.responses.forEach((res) => counts[res.answer]++);

    const total = poll.responses.length || 1;
    const percentages = {};
    Object.entries(counts).forEach(
        ([opt, count]) =>
            (percentages[opt] = ((count / total) * 100).toFixed(1))
    );

    return {
        question: poll.question,
        options: poll.options, // includes { text, isCorrect }
        percentages,
        totalResponses: poll.responses.length,
    };
};
