const Violation = require("../models/Violation");
const Appeal = require("../models/Appeal");
const Notification = require("../models/Notification");
const Owner = require("../models/Owner");
const bcrypt = require("bcryptjs");
const { buildFlexiblePlateRegex } = require("../utils/normalizePlate");

const SALT_ROUNDS = 10;

// GET /api/owner/violations/mine
async function myViolations(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { owner: req.user.id };

    const [violations, totalCount] = await Promise.all([
      Violation.find(filter)
        .populate("enforcer", "fullName badgeNumber")
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

    // One appeal per violation. The owner page already hides the button once
    // an appeal exists; this check makes the server enforce it too, so the
    // administrator is never flooded with repeated appeals for one violation.
    const alreadyAppealed = await Appeal.findOne({ violation: violationId });
    if (alreadyAppealed) {
      return res.status(409).json({ message: "This violation already has an appeal." });
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

// PATCH /api/owner/profile
// Lets an owner update their own contact details -- email, contact
// number, and address. Plate number, vehicle type/color are intentionally
// left out here; those are handled by the vehicle-management endpoints,
// not general profile editing.
async function updateProfile(req, res) {
  try {

    const { email, contactNumber, address } = req.body;

    if (!email || !contactNumber) {
      return res.status(400).json({ message: "Email and contact number are required." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await Owner.findOne({
      email: normalizedEmail,
      _id: { $ne: req.user.id },
    });

    if (existing) {
      return res.status(409).json({ message: "That email address is already in use by another account." });
    }

    const owner = await Owner.findByIdAndUpdate(
      req.user.id,
      { email: normalizedEmail, contactNumber, address: address || "" },
      { new: true }
    ).select("-password");

    if (!owner) {
      return res.status(404).json({ message: "Owner account not found." });
    }

    res.json({ message: "Profile updated.", owner });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile." });
  }
}

// PATCH /api/owner/password
// Lets an owner change their own password from the profile screen,
// verifying their current password first.
async function changePassword(req, res) {
  try {

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Your new password must be at least 8 characters long." });
    }

    const owner = await Owner.findById(req.user.id);

    if (!owner) {
      return res.status(404).json({ message: "Owner account not found." });
    }

    const matches = await bcrypt.compare(currentPassword, owner.password);

    if (!matches) {
      return res.status(401).json({ message: "Your current password is incorrect." });
    }

    owner.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await owner.save();

    res.json({ message: "Password changed successfully." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to change password." });
  }
}

// Checks whether a plate number is already registered to ANY account --
// either as someone's primary plate, or as one of their additional
// vehicles. When editing an existing additional vehicle, pass its own
// _id as excludeVehicleId so it doesn't flag itself as a duplicate of
// itself when its plate hasn't actually changed.
async function isPlateTaken(plateNumber, excludeVehicleId) {

  const plateRegex = buildFlexiblePlateRegex(plateNumber);
  if (!plateRegex) return false;

  const match = await Owner.findOne({
    $or: [
      { plateNumber: { $regex: plateRegex } },
      { "additionalVehicles.plateNumber": { $regex: plateRegex } },
    ],
  });

  if (!match) return false;

  if (excludeVehicleId) {
    const isPrimaryMatch = plateRegex.test(match.plateNumber);
    if (isPrimaryMatch) return true;

    const stillMatchesAnother = match.additionalVehicles.some(
      (v) => String(v._id) !== String(excludeVehicleId) && plateRegex.test(v.plateNumber)
    );
    return stillMatchesAnother;
  }

  return true;
}

// NOTE: there is intentionally no "add vehicle" endpoint. Vehicles can only be
// registered at sign-up, where the administrator reviews them before the
// account is approved. A vehicle added later would skip that review.

// PATCH /api/owner/vehicles/:vehicleId
async function updateVehicle(req, res) {
  try {

    const { vehicleId } = req.params;
    const { plateNumber, vehicleType, vehicleColor } = req.body;

    if (typeof plateNumber !== "string" || !plateNumber.trim()) {
      return res.status(400).json({ message: "Plate number is required." });
    }

    const taken = await isPlateTaken(plateNumber, vehicleId);
    if (taken) {
      return res.status(409).json({ message: "This plate number is already registered to an account." });
    }

    const owner = await Owner.findOneAndUpdate(
      { _id: req.user.id, "additionalVehicles._id": vehicleId },
      {
        $set: {
          "additionalVehicles.$.plateNumber": plateNumber.toUpperCase().trim(),
          "additionalVehicles.$.vehicleType": vehicleType || "",
          "additionalVehicles.$.vehicleColor": vehicleColor || "",
        },
      },
      { new: true }
    ).select("-password");

    if (!owner) {
      return res.status(404).json({ message: "Vehicle not found." });
    }

    res.json({ message: "Vehicle updated.", owner });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update vehicle." });
  }
}

// DELETE /api/owner/vehicles/:vehicleId
async function deleteVehicle(req, res) {
  try {

    const { vehicleId } = req.params;

    const owner = await Owner.findByIdAndUpdate(
      req.user.id,
      { $pull: { additionalVehicles: { _id: vehicleId } } },
      { new: true }
    ).select("-password");

    if (!owner) {
      return res.status(404).json({ message: "Owner account not found." });
    }

    res.json({ message: "Vehicle removed.", owner });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove vehicle." });
  }
}

module.exports = {
  myViolations,
  submitAppeal,
  myAppeals,
  myNotifications,
  markNotificationRead,
  updateProfile,
  changePassword,
  updateVehicle,
  deleteVehicle,
};
