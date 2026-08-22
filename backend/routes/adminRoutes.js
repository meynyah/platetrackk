const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const admin = require("../controllers/adminController");

// Every route below requires a valid admin JWT.
router.use(verifyToken, requireRole("admin"));

// Dashboard / statistics (requirement 10: admin-only overall stats)
router.get("/stats", admin.getStats);
router.get("/enforcers/leaderboard", admin.getEnforcerStats);

// Enforcer account review (requirement 6)
router.get("/enforcers", admin.listEnforcers);
router.patch("/enforcers/:id/approve", admin.approveEnforcer);
router.patch("/enforcers/:id/reject", admin.rejectEnforcer);

// Owner account review (requirement 7)
router.get("/owners", admin.listOwners);
router.patch("/owners/:id/approve", admin.approveOwner);
router.patch("/owners/:id/reject", admin.rejectOwner);
router.patch("/owners/:id/flag", admin.flagOwner);
router.patch("/owners/:id/unflag", admin.unflagOwner);

// Violations (requirement 1)
router.get("/violations", admin.listViolations);

// Appeals (requirements 4 & 9)
router.get("/appeals", admin.listAppeals);
router.patch("/appeals/:id/under-review", admin.markAppealUnderReview);
router.patch("/appeals/:id/resolve", admin.resolveAppeal);

// Announcements (requirement 5)
router.post("/announcements", admin.createAnnouncement);
router.get("/announcements", admin.listAnnouncements);

module.exports = router;
