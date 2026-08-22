const Violation = require("../models/Violation");
const Appeal = require("../models/Appeal");
const Notification = require("../models/Notification");

// GET /api/owner/violations/mine
async function myViolations(req, res) {
  try {
    const violations = await Violation.find({ owner: req.user.id })
      .populate("enforcer", "fullName badgeNumber")
      .sort({ dateTime: -1 });
    res.json(violations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your violations." });
  }
}

// POST /api/owner/appeals   body: { violationId, reason, supportingDetails }
// This is how "lahat ng appeals ng vehicle owner" reach the admin
// (requirement 4) — written to the shared database, visible immediately on
// the admin's Appeals Queue.
async function submitAppeal(req, res) {
  try {
    const { violationId, reason, supportingDetails } = req.body;
    if (!violationId || !reason) {
      return res.status(400).json({ message: "violationId and reason are required." });
    }

    const violation = await Violation.findById(violationId);
    if (!violation) return res.status(404).json({ message: "Violation not found." });
    if (String(violation.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: "You can only appeal violations linked to your own account." });
    }

    const appeal = await Appeal.create({
      violation: violationId,
      owner: req.user.id,
      reason,
      supportingDetails,
      status: "submitted",
    });

    violation.status = "appealed";
    await violation.save();

    res.status(201).json({ message: "Appeal submitted and sent to the PlateTrack Administrator for review.", appeal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit appeal." });
  }
}

// GET /api/owner/appeals/mine
async function myAppeals(req, res) {
  try {
    const appeals = await Appeal.find({ owner: req.user.id }).populate("violation").sort({ createdAt: -1 });
    res.json(appeals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your appeals." });
  }
}

// GET /api/owner/notifications
// Where "under review" and resolution feedback (requirement 9) show up.
async function myNotifications(req, res) {
  try {
    const notifications = await Notification.find({ recipient: req.user.id, recipientModel: "Owner" }).sort({
      createdAt: -1,
    });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load notifications." });
  }
}

// PATCH /api/owner/notifications/:id/read
async function markNotificationRead(req, res) {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: "Notification not found." });
    res.json(notif);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notification." });
  }
}

module.exports = { myViolations, submitAppeal, myAppeals, myNotifications, markNotificationRead };
