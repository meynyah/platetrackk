const Violation = require("../models/Violation");
const Owner = require("../models/Owner");
const Notification = require("../models/Notification");
const Enforcer = require("../models/Enforcer");
const bcrypt = require("bcryptjs");
const { buildFlexiblePlateRegex } = require("../utils/normalizePlate");

const SALT_ROUNDS = 10;

// Shared by both automatic detection (detectPlate) and manual plate lookup
// (lookupOwnerByPlate) -- finds the registered owner for a given plate
// number, the same flexible way plates are matched when a violation is
// submitted (so "NFV 3230" matches an owner registered as "NFV-3230",
// etc.), and figures out exactly which of that owner's vehicles matched
// (since an owner can have more than one registered vehicle).
async function findOwnerByPlate(plateNumber) {
  const plateRegex = buildFlexiblePlateRegex(plateNumber);
  if (!plateRegex) {
    return { found: false };
  }

  const owner = await Owner.findOne({
    $or: [
      { plateNumber: { $regex: plateRegex } },
      { "additionalVehicles.plateNumber": { $regex: plateRegex } },
    ],
  });

  if (!owner) {
    return { found: false };
  }

  let matchedVehicle = null;
  if (plateRegex.test(owner.plateNumber)) {
    matchedVehicle = {
      plateNumber: owner.plateNumber,
      vehicleType: owner.vehicleType,
      vehicleColor: owner.vehicleColor,
      orCrNumber: owner.orCrNumber,
    };
  } else {
    matchedVehicle =
      owner.additionalVehicles.find((v) => plateRegex.test(v.plateNumber)) || null;
  }

  if (!matchedVehicle) {
    return { found: false };
  }

  return {
    found: true,
    fullName: owner.fullName,
    email: owner.email,
    address: owner.address || "",
    registeredPlateNumber: matchedVehicle.plateNumber,
    vehicleType: matchedVehicle.vehicleType || "",
    vehicleColor: matchedVehicle.vehicleColor || "",
    orCrNumber: matchedVehicle.orCrNumber || "",
  };
}

// GET /api/enforcer/lookup-owner?plateNumber=...
// Lets the manual-violation form look up the registered owner for a
// plate the enforcer typed in by hand (e.g. because the plate was dirty
// or partially obstructed and automatic detection wasn't used/didn't
// succeed) -- so the enforcer can still see who the vehicle is
// registered to, and cross-check it, before saving the report.
async function lookupOwnerByPlate(req, res) {
  try {

    const enforcer = await Enforcer.findById(req.user.id);

    if (!enforcer || !enforcer.onDuty) {
      return res.status(403).json({
        message: "You must be on duty to look up a registered owner. Toggle your duty status on from the dashboard first.",
      });
    }

    const plateNumber = req.query.plateNumber;

    if (!plateNumber || !String(plateNumber).trim()) {
      return res.status(400).json({ message: "A plate number is required." });
    }

    const owner = await findOwnerByPlate(plateNumber);
    res.json({ owner });

  } catch (err) {
    console.error("Owner lookup error:", err);
    res.status(500).json({ message: "Failed to look up the registered owner." });
  }
}

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
      ? await Owner.findOne({
          $or: [
            { plateNumber: { $regex: plateRegex } },
            { "additionalVehicles.plateNumber": { $regex: plateRegex } },
          ],
        })
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
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { enforcer: req.user.id };

    const [violations, totalCount] = await Promise.all([
      Violation.find(filter)
        .populate("owner", "fullName email address")
        .sort({ dateTime: -1 })
        .skip(skip)
        .limit(limit),
      Violation.countDocuments(filter),
    ]);

    res.json({
      violations,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      currentPage: page,
    });
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

    // Look up the registered vehicle owner by the detected plate -- see
    // findOwnerByPlate above for the matching logic (also used by the
    // manual-lookup endpoint below).
    const ownerResult = await findOwnerByPlate(result.plateNumber);

    res.json({
      success: true,
      plateNumber: result.plateNumber,
      detectionConfidence: result.detectionConfidence,
      ocrConfidence: result.ocrConfidence,
      processingTimeMs: result.processingTimeMs,
      boundingBox: result.boundingBox,
      owner: ownerResult,
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

// PATCH /api/enforcer/profile
// Lets an enforcer update their own contact details -- email, mobile
// number, and station. Badge number and full name are intentionally left
// out here since those are official designations, not self-editable
// contact info.
async function updateProfile(req, res) {
  try {

    const { email, mobile } = req.body;

    if (!email || !mobile) {
      return res.status(400).json({ message: "Email and mobile number are required." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (!/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({ message: "Please enter a valid 11-digit Philippine mobile number." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // If the email is changing, make sure no other enforcer account
    // already uses it -- email is unique per the schema, so a duplicate
    // save would otherwise fail with a raw Mongo error.
    const existing = await Enforcer.findOne({
      email: normalizedEmail,
      _id: { $ne: req.user.id },
    });

    if (existing) {
      return res.status(409).json({ message: "That email address is already in use by another account." });
    }

    const enforcer = await Enforcer.findByIdAndUpdate(
      req.user.id,
      { email: normalizedEmail, mobile },
      { new: true }
    ).select("-password");

    if (!enforcer) {
      return res.status(404).json({ message: "Enforcer account not found." });
    }

    res.json({ message: "Profile updated.", enforcer });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile." });
  }
}

// PATCH /api/enforcer/password
// Lets an enforcer change their own password from the profile screen,
// verifying their current password first.
async function changePassword(req, res) {
  try {

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
    }

    const strongEnough =
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /\d/.test(newPassword);

    if (!strongEnough) {
      return res.status(400).json({
        message: "Use at least 8 characters with uppercase, lowercase, and a number.",
      });
    }

    const enforcer = await Enforcer.findById(req.user.id);

    if (!enforcer) {
      return res.status(404).json({ message: "Enforcer account not found." });
    }

    const matches = await bcrypt.compare(currentPassword, enforcer.password);

    if (!matches) {
      return res.status(401).json({ message: "Your current password is incorrect." });
    }

    enforcer.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await enforcer.save();

    res.json({ message: "Password changed successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to change password." });
  }
}

module.exports = {
  submitViolation,
  myViolations,
  myNotifications,
  markNotificationRead,
  detectPlate,
  lookupOwnerByPlate,
  setDutyStatus,
  getDutyStatus,
  updateProfile,
  changePassword,
};
