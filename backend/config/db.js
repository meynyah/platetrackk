const mongoose = require("mongoose");

async function connectDB() {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 20000
        });

        console.log(`[db] MongoDB connected: ${conn.connection.host}`);

        mongoose.connection.on("disconnected", () => {
            console.error("[db] MongoDB disconnected.");
        });

        mongoose.connection.on("error", (error) => {
            console.error(`[db] MongoDB error: ${error.message}`);
        });

    } catch (error) {
        console.error(`[db] Connection failed: ${error.message}`);
        process.exit(1);
    }
}

module.exports = connectDB;