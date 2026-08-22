const express = require("express");
const router = express.Router();
const {
  registerEnforcer,
  loginEnforcer,
  registerOwner,
  loginOwner,
  loginAdmin,
} = require("../controllers/authController");

// idagdag mo itong bagong import
const {
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} = require("../controllers/passwordResetController");

const { loginLimiter, registerLimiter, resetLimiter } = require("../middleware/rateLimiters");

router.post("/enforcer/register", registerLimiter, registerEnforcer);
router.post("/enforcer/login", loginLimiter, loginEnforcer);

router.post("/owner/register", registerLimiter, registerOwner);
router.post("/owner/login", loginLimiter, loginOwner);

router.post("/admin/login", loginLimiter, loginAdmin);

// idagdag mo itong bagong routes
router.post("/forgot-password", resetLimiter, requestPasswordReset);
router.post("/verify-reset-code", resetLimiter, verifyResetCode);
router.post("/reset-password", resetLimiter, resetPassword);

module.exports = router;