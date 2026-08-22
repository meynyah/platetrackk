const mongoose = require("mongoose");

// A brief network blip during the very first connection attempt (which
// does happen occasionally, even on stable hosts) used to crash the whole
// server immediately, requiring someone to manually restart it. This
// retries a few times with a short delay first instead of giving up
// right away.
async function connectWithRetry(retriesLeft = 4, delayMs = 3000) {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 20000
        });

        console.log(`[db] MongoDB connected: ${conn.connection.host}`);

        mongoose.connection.on("disconnected", () => {
            console.error("[db] MongoDB disconnected. The driver will attempt to reconnect automatically.");
        });

        mongoose.connection.on("reconnected", () => {
            console.log("[db] MongoDB reconnected.");
        });

        mongoose.connection.on("error", (error) => {
            console.error(`[db] MongoDB error: ${error.message}`);
        });

    } catch (error) {

        console.error(`[db] Connection attempt failed: ${error.message}`);

        if (retriesLeft > 0) {
            console.log(`[db] Retrying in ${delayMs / 1000}s... (${retriesLeft} attempt(s) left)`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return connectWithRetry(retriesLeft - 1, delayMs);
        }

        console.error("[db] All connection attempts failed. Exiting.");
        process.exit(1);
    }
}

async function connectDB() {
    return connectWithRetry();
}

module.exports = connectDB;