const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const owner = require("../controllers/ownerController");

router.use(verifyToken, requireRole("owner"));

router.get("/violations/mine", owner.myViolations);

router.post("/appeals", owner.submitAppeal);
router.get("/appeals/mine", owner.myAppeals);

router.get("/notifications", owner.myNotifications);
router.patch("/notifications/:id/read", owner.markNotificationRead);

module.exports = router;
