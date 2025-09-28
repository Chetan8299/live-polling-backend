import mongoose from 'mongoose';
import { connectDB } from './config/connection.js';
import Poll from './models/poll.model.js';

// Simple migration script to handle existing polls
async function migratePollsIfNeeded() {
    await connectDB();
    
    // Check if there are any polls without teacherSocketId
    const pollsWithoutTeacher = await Poll.find({ teacherSocketId: { $exists: false } });
    
    if (pollsWithoutTeacher.length > 0) {
        console.log(`Found ${pollsWithoutTeacher.length} polls without teacherSocketId.`);
        console.log('These polls will not appear in poll history until new polls are created.');
        
        // Optionally, you could assign them to a default teacher or remove them
        // For now, we'll just log them
        pollsWithoutTeacher.forEach((poll, index) => {
            console.log(`Poll ${index + 1}: ${poll.question} (${poll.responses.length} responses)`);
        });
    } else {
        console.log('All polls have teacherSocketId. No migration needed.');
    }
    
    mongoose.connection.close();
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migratePollsIfNeeded().catch(console.error);
}

export { migratePollsIfNeeded };
