import mongoose from "mongoose";
import { mongoURI } from "./config.js";

// 🔹 Connect MongoDB
export const connectDB = async () => {
    try {
        await mongoose.connect(mongoURI);
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.error("❌ MongoDB error:", err.message);
        process.exit(1); // Stop the server if DB connection fails
    }
};
