import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false }
});

const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [optionSchema], // now includes text + correctness
    responses: [
      {
        studentName: String,
        answer: String, // stores option text chosen
      },
    ],
    timeLimit: { type: Number, default: 60 }, // seconds
    teacherSocketId: { type: String, required: true }, // track which teacher created this poll
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Poll", pollSchema);
