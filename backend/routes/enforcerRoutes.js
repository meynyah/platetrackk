const express = require("express");
const router = express.Router();
const multer = require("multer");
const { verifyToken, requireRole } = require("../middleware/auth");
const enforcer = require("../controllers/enforcerController");

// Keep the uploaded photo in memory (not written to disk) since we just
// forward it straight to the ML service and discard it afterward.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(verifyToken, requireRole("enforcer"));

router.post("/violations", enforcer.submitViolation);
router.get("/violations/mine", enforcer.myViolations);

router.post("/detect-plate", upload.single("image"), enforcer.detectPlate);

router.get("/notifications", enforcer.myNotifications);
router.patch("/notifications/:id/read", enforcer.markNotificationRead);

module.exports = router;
