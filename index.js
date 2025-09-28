import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import Poll from "./models/poll.model.js";
import { connectDB } from "./config/connection.js";
import { calculateResults } from "./utils/result.js";
import { PORT } from "./config/config.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

connectDB();

let activePoll = null;
let teacherSocketId = null;
let pollTimer = null;
let timeRemaining = 0;
let submittedStudents = new Set(); // Track students who have submitted answers

io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id);

    // 🔹 Student registration
    socket.on("register_student", (name) => {
        socket.data.role = "student";
        socket.data.name = name;
        console.log(`Student registered: ${name}`);
    });

    // 🔹 Teacher registration
    socket.on("register_teacher", () => {
        if (teacherSocketId) {
            // someone is already teacher
            socket.emit("teacher_rejected", { msg: "Teacher already exists!" });
            return;
        }
        teacherSocketId = socket.id;
        socket.data.role = "teacher";
        console.log("Teacher registered:", socket.id);
    });

    // 🔹 Teacher creates poll
    socket.on("ask_question", async ({ question, options, timeLimit }) => {
        if (socket.data.role !== "teacher") return;

        // Clear any existing timer
        if (pollTimer) {
            clearInterval(pollTimer);
        }

        // options now include isCorrect field from frontend
        const newPoll = new Poll({ 
            question, 
            options, 
            timeLimit,
            teacherSocketId: socket.id
        });
        await newPoll.save();

        activePoll = newPoll;
        timeRemaining = timeLimit;
        submittedStudents.clear(); // Clear previous submissions

        // Emit new question to all users
        io.emit("new_question", {
            id: newPoll._id,
            question: newPoll.question,
            options: newPoll.options,
            timeLimit: newPoll.timeLimit,
            timeRemaining: timeRemaining
        });

        // Start countdown timer
        pollTimer = setInterval(async () => {
            timeRemaining--;
            
            // Send timer update to all clients
            io.emit("timer_update", { timeRemaining });
            
            // Send live results to teacher and submitted students
            if (activePoll) {
                const result = await calculateResults(activePoll._id);
                
                // Send to teacher
                if (teacherSocketId) {
                    io.to(teacherSocketId).emit("live_poll_update", result);
                }
                
                // Send to all students who have submitted
                submittedStudents.forEach((studentSocketId) => {
                    io.to(studentSocketId).emit("live_student_update", result);
                });
            }
            
            if (timeRemaining <= 0) {
                clearInterval(pollTimer);
                if (activePoll) {
                    const result = await calculateResults(activePoll._id);
                    io.emit("poll_ended", result);
                    activePoll = null;
                }
            }
        }, 1000);
    });

    // 🔹 Student answers
    socket.on("submit_answer", async ({ pollId, option }) => {
        const poll = await Poll.findById(pollId);
        if (!poll) return;

        // Prevent duplicate answers from same student
        const alreadyAnswered = poll.responses.find(
            (res) => res.studentName === socket.data.name
        );
        if (alreadyAnswered) return;

        poll.responses.push({ studentName: socket.data.name, answer: option });
        await poll.save();

        // Add student to submitted students set
        submittedStudents.add(socket.id);

        // Send confirmation to the student who submitted
        socket.emit("answer_submitted", { success: true });
        
        // Calculate results
        const result = await calculateResults(poll._id);
        
        // Send results to the student who just answered
        socket.emit("poll_result", result);
        
        // Send live updates to all students who have already submitted (including this one)
        submittedStudents.forEach((studentSocketId) => {
            io.to(studentSocketId).emit("live_student_update", result);
        });
        
        // Send live update to teacher
        if (teacherSocketId) {
            io.to(teacherSocketId).emit("live_poll_update", result);
        }
    });

    // 🔹 Teacher requests poll history
    socket.on("get_poll_history", async () => {
        if (socket.data.role !== "teacher") return;
        
        // Only get polls created by this teacher
        const polls = await Poll.find({ teacherSocketId: socket.id }).sort({ createdAt: -1 });

        const formatted = polls.map((poll) => {
            const counts = {};
            // Initialize counts for each option using the text field
            poll.options.forEach((opt) => (counts[opt.text] = 0));
            poll.responses.forEach((res) => counts[res.answer]++);

            const total = poll.responses.length;
            const percentages = {};
            
            // Calculate percentages for each option
            poll.options.forEach((opt) => {
                const count = counts[opt.text] || 0;
                if (total === 0) {
                    percentages[opt.text] = "0.0";
                } else {
                    percentages[opt.text] = ((count / total) * 100).toFixed(1);
                }
            });

            return {
                question: poll.question,
                options: poll.options, // Include full option data with isCorrect
                percentages,
                totalResponses: poll.responses.length,
                createdAt: poll.createdAt,
            };
        });

        socket.emit("poll_history", formatted);
    });

    socket.on("disconnect", () => {
        console.log("❌ Disconnected:", socket.id);
        
        // Remove student from submitted students if they disconnect
        submittedStudents.delete(socket.id);

        if (socket.id === teacherSocketId) {
            teacherSocketId = null;
            // Clear any active timers when teacher leaves
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            activePoll = null;
            submittedStudents.clear();
            console.log("Teacher left, poll ended and slot freed");
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
