const rateLimit = require("express-rate-limit");

// Applies to login endpoints (enforcer/owner/admin). Generous enough for a
// real user who mistypes a password a few times, tight enough to make
// credential-stuffing / brute force impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

// Applies to registration endpoints — mainly to slow down automated
// account-creation spam.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Please try again later." },
});

// Applies to the forgot-password / verify-reset-code / reset-password
// endpoints. Stricter than login since these guard a 6-digit code.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

module.exports = { loginLimiter, registerLimiter, resetLimiter };
