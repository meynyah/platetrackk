const mongoose = require("mongoose");

const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["enforcer", "owner", "admin"], required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    // Number of incorrect codes entered against this record. Once this hits
    // MAX_ATTEMPTS (see passwordResetController.js) the code is invalidated
    // and the user must request a fresh one — prevents brute-forcing the
    // 6-digit code within its expiry window.
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasswordReset", passwordResetSchema);