require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const enforcerRoutes = require("./routes/enforcerRoutes");
const ownerRoutes = require("./routes/ownerRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // higher limit to allow base64 violation photos
app.use((req, res, next) => {
    console.log(`[request] ${req.method} ${req.originalUrl}`);

    res.on("finish", () => {
        console.log(
            `[response] ${req.method} ${req.originalUrl} - ${res.statusCode}`
        );
    });

    next();
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/enforcer", enforcerRoutes);
app.use("/api/owner", ownerRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error." });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] PlateTrack API running on port ${PORT}`));
});
