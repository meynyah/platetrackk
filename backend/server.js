require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Only the actual PlateTrack frontends (and Netlify's preview-deploy
// subdomains, useful while testing) should be allowed to call this API --
// previously this was wide open to any origin at all.
const allowedOriginPattern = /^https:\/\/([a-z0-9-]+--)?platetrackk\.netlify\.app$/i;

const corsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header (e.g. server-to-server calls, some
    // mobile/PWA install contexts, curl/Postman) are allowed through --
    // browsers always send Origin for cross-site fetches, so this does
    // not weaken protection against unwanted browser-based access.
    if (!origin || allowedOriginPattern.test(origin)) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
};
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const enforcerRoutes = require("./routes/enforcerRoutes");
const ownerRoutes = require("./routes/ownerRoutes");

const app = express();

// Render (like Heroku and most PaaS hosts) puts the app behind a single
// reverse proxy, which sets X-Forwarded-For to the real client IP. Without
// this, Express's default "don't trust any proxy" setting makes
// express-rate-limit refuse to use that header at all (logged as
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) since trusting it blindly would let a
// client fake their own IP by sending their own X-Forwarded-For. Trusting
// exactly one hop tells Express to use only the IP the proxy itself
// recorded, which can't be spoofed by the client.
app.set("trust proxy", 1);

app.use(cors(corsOptions));
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
