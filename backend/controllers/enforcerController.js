const Violation = require("../models/Violation");
const Owner = require("../models/Owner");
const Notification = require("../models/Notification");
const Enforcer = require("../models/Enforcer");
const { buildFlexiblePlateRegex } = require("../utils/normalizePlate");

// POST /api/enforcer/violations
// This is how "lahat ng reports ng traffic enforcer" reach the admin — every
// report an enforcer submits is written straight to the shared database that
// the admin dashboard reads from.

async function submitViolation(req, res) {
  try {

    // Only an enforcer who is actually on duty can file a violation --
    // this is the real, backend-enforced check (not just a UI badge) that
    // prevents PlateTrack from being used off-shift.
    const enforcer = await Enforcer.findById(req.user.id);

    if (!enforcer || !enforcer.onDuty) {
      return res.status(403).json({
        message: "You must be on duty to submit a violation report. Toggle your duty status on from the dashboard first.",
      });
    }

    const {
      plateNumber,
      vehicleType,
      vehicleColor,
      violationType,
      location,
      dateTime,
      photoUrl,
      notes
    } = req.body;

    if (!plateNumber || !violationType) {
      return res.status(400).json({ message: "plateNumber and violationType are required." });
    }

    // Match the owner by plate number even if the enforcer typed it with
    // different spacing/dashes than how the owner registered it (e.g.
    // "JCG 5463" vs "JCG-5463" vs "JCG5463" should all match the same
    // plate) — otherwise the violation silently never links to an owner.
    const plateRegex = buildFlexiblePlateRegex(plateNumber);
    const owner = plateRegex
      ? await Owner.findOne({ plateNumber: { $regex: plateRegex } })
      : null;

    const violation = await Violation.create({
      enforcer: req.user.id,
      plateNumber,
      vehicleType,
      vehicleColor,
      owner: owner ? owner._id : null,
      violationType,
      location,
      dateTime: dateTime || new Date(),
      photoUrl,
      notes,
    });

    res.status(201).json({
      message: "Violation report submitted.",
      violation
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to submit violation report."
    });
  }
}

// GET /api/enforcer/violations/mine
async function myViolations(req, res) {
  try {
    const violations = await Violation.find({ enforcer: req.user.id }).sort({ dateTime: -1 });
    res.json(violations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load your reports." });
  }
}

// GET /api/enforcer/notifications
// Where announcements from the admin (requirement 5) show up.
async function myNotifications(req, res) {
  try {
    const notifications = await Notification.find({ recipient: req.user.id, recipientModel: "Enforcer" }).sort({
      createdAt: -1,
    });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load notifications." });
  }
}

// PATCH /api/enforcer/notifications/:id/read
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

// POST /api/enforcer/detect-plate
// Forwards a captured photo to the Python ML microservice (YOLOv8 +
// PaddleOCR, see the PlateTrack_ANPR_Pipeline Colab notebook) and returns
// whatever it detected. This endpoint exists so the frontend never talks to
// the ML service directly — it only ever calls our own backend, same as
// everything else in the app. If ML_SERVICE_URL isn't configured (e.g. no
// Colab session running right now), this fails gracefully so the enforcer
// can still fall back to manual entry on the violation form.
async function detectPlate(req, res) {
  try {

    // Same on-duty requirement as submitting a violation -- detection
    // itself is gated too, since letting an off-duty enforcer detect
    // plates (even without filing anything) is still the exact misuse
    // this feature exists to prevent.
    const enforcer = await Enforcer.findById(req.user.id);

    if (!enforcer || !enforcer.onDuty) {
      return res.status(403).json({
        message: "You must be on duty to use plate detection. Toggle your duty status on from the dashboard first.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image was uploaded." });
    }

    const mlServiceUrl = process.env.ML_SERVICE_URL;

    if (!mlServiceUrl) {
      return res.status(503).json({
        message: "The plate-detection service isn't configured right now. Please enter the details manually.",
      });
    }

    // Build a multipart request to the FastAPI /detect endpoint, matching
    // what it expects: a single "image" field.
    const formData = new FormData();
    const imageBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("image", imageBlob, req.file.originalname || "capture.jpg");

    const mlResponse = await fetch(`${mlServiceUrl.replace(/\/$/, "")}/detect`, {
      method: "POST",
      body: formData,
    });

    if (!mlResponse.ok) {
      return res.status(502).json({
        message: "The plate-detection service returned an error. Please enter the details manually.",
      });
    }

    const result = await mlResponse.json();

    if (!result.success) {
      return res.json({
        success: false,
        message: result.message || "No license plate detected. Please enter the details manually.",
      });
    }

    // Look up the registered vehicle owner by the detected plate, the same
    // flexible way we match plates when a violation is submitted (so
    // "NFV 3230" matches an owner registered as "NFV-3230", etc.). If we
    // find one, the enforcer's screen can auto-fill the owner's name,
    // email, and registered vehicle type/color instead of leaving them to
    // type it in blind.
    const plateRegex = buildFlexiblePlateRegex(result.plateNumber);
    const owner = plateRegex
      ? await Owner.findOne({ plateNumber: { $regex: plateRegex } })
      : null;

    res.json({
      success: true,
      plateNumber: result.plateNumber,
      detectionConfidence: result.detectionConfidence,
      ocrConfidence: result.ocrConfidence,
      processingTimeMs: result.processingTimeMs,
      boundingBox: result.boundingBox,
      owner: owner
        ? {
            found: true,
            fullName: owner.fullName,
            email: owner.email,
            registeredPlateNumber: owner.plateNumber,
            vehicleType: owner.vehicleType || "",
            vehicleColor: owner.vehicleColor || "",
          }
        : { found: false },
    });

  } catch (err) {
    console.error("Plate detection error:", err);
    res.status(503).json({
      message: "Unable to reach the plate-detection service right now. Please enter the details manually.",
    });
  }
}

// PATCH /api/enforcer/duty-status
// Lets an approved enforcer toggle their own on-duty status. The frontend
// sends { onDuty: true } or { onDuty: false } explicitly rather than just
// "toggle," so a stale double-click can't accidentally flip it back.
async function setDutyStatus(req, res) {
  try {

    const { onDuty } = req.body;

    if (typeof onDuty !== "boolean") {
      return res.status(400).json({ message: "onDuty must be true or false." });
    }

    const enforcer = await Enforcer.findByIdAndUpdate(
      req.user.id,
      { onDuty, dutyChangedAt: new Date() },
      { new: true }
    );

    if (!enforcer) {
      return res.status(404).json({ message: "Enforcer account not found." });
    }

    res.json({
      onDuty: enforcer.onDuty,
      dutyChangedAt: enforcer.dutyChangedAt,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update duty status." });
  }
}

// GET /api/enforcer/duty-status
// Lets the dashboard load the enforcer's current duty status on page load
// (e.g. after logging back in), instead of always defaulting the toggle
// to "off" visually until they touch it.
async function getDutyStatus(req, res) {
  try {

    const enforcer = await Enforcer.findById(req.user.id);

    if (!enforcer) {
      return res.status(404).json({ message: "Enforcer account not found." });
    }

    res.json({
      onDuty: enforcer.onDuty,
      dutyChangedAt: enforcer.dutyChangedAt,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load duty status." });
  }
}

module.exports = {
  submitViolation,
  myViolations,
  myNotifications,
  markNotificationRead,
  detectPlate,
  setDutyStatus,
  getDutyStatus,
};
