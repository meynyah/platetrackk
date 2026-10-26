const bcrypt = require("bcryptjs");
const Enforcer = require("../models/Enforcer");
const Owner = require("../models/Owner");
const Violation = require("../models/Violation");
const Admin = require("../models/Admin");
const Notification = require("../models/Notification");
const generateToken = require("../utils/generateToken");
const { buildFlexiblePlateRegex, normalizePlate } = require("../utils/normalizePlate");

const SALT_ROUNDS = 10;

/* ---------------------------- ENFORCER ---------------------------- */

// POST /api/auth/enforcer/register
async function registerEnforcer(req, res) {
  try {
    const {
      fullName,
      email,
      badgeNumber,
      station,
      mobile,
      password
    } = req.body;

    if (!fullName || !email || !badgeNumber || !password) {
      return res.status(400).json({
        message: "Please fill in all required fields."
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedBadgeNumber = String(badgeNumber).trim().toUpperCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    if (mobile && !/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({
        message: "Please enter a valid 11-digit Philippine mobile number."
      });
    }

    const holds = [
      { email: normalizedEmail },
      { badgeNumber: normalizedBadgeNumber }
    ];

    // Pending and approved accounts keep their email and badge number
    // reserved, so two enforcers can never share one.
    const blocking = await Enforcer.findOne({ status: { $ne: "rejected" }, $or: holds });

    if (blocking) {
      return res.status(409).json({
        message: "An account with this email or badge number already exists."
      });
    }

    // A REJECTED application does not keep anything reserved, so an applicant
    // who made a typing mistake can register again. The same email replaces
    // the rejected record; another rejected record that holds the badge number
    // is removed (the badge number must be unique in the database, and a
    // rejected applicant has no access to the account anyway).
    const rejectedHolders = await Enforcer.find({ status: "rejected", $or: holds });
    const sameEmailRecord = rejectedHolders.find((e) => e.email === normalizedEmail) || null;

    for (const old of rejectedHolders) {
      if (old !== sameEmailRecord) {
        await Enforcer.deleteOne({ _id: old._id });
      }
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const details = {
      fullName: String(fullName).trim(),
      badgeNumber: normalizedBadgeNumber,
      station: String(station || "").trim() || "Antipolo Traffic Management Office",
      mobile: mobile || undefined,
      password: hashed
    };

    let enforcer;
    let resubmitted = false;

    if (sameEmailRecord) {
      // Back to pending, so the administrator reviews it again from the start.
      enforcer = await Enforcer.findByIdAndUpdate(
        sameEmailRecord._id,
        {
          $set: {
            ...details,
            status: "pending",
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            onDuty: false
          }
        },
        { new: true, runValidators: true }
      );
      resubmitted = true;
    } else {
      enforcer = await Enforcer.create({
        ...details,
        email: normalizedEmail,
        status: "pending"
      });
    }

    return res.status(201).json({
      message: resubmitted
        ? "Your registration was submitted again. It will be reviewed by the PlateTrack Administrator. You can only sign in after your account has been approved."
        : "Registration submitted. Your registration will be reviewed by the PlateTrack Administrator. You can only sign in after your account has been approved.",
      enforcerId: enforcer._id,
      resubmitted
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error during registration."
    });
  }
}

// The rejection reason is typed by the administrator and shown on the
// applicant's sign-in screen. The reply carries it twice: inside "message"
// (plain text with line breaks, special characters escaped, for any simple
// client) and as "reason" + "code" so the login pages can lay it out neatly.
function rejectedReply(reason) {
  const clean = String(reason || "").trim().slice(0, 300);
  const safe = clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = ["Your registration was not approved."];
  if (safe) lines.push(`Reason: ${safe}`);
  lines.push("Please contact the PlateTrack Administrator for details.");
  return { message: lines.join("\n\n"), reason: clean, code: "REGISTRATION_REJECTED" };
}

// POST /api/auth/enforcer/login
async function loginEnforcer(req, res) {
  try {
    const { email, password, rememberDevice } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const enforcer = await Enforcer.findOne({ email: normalizedEmail });

    if (!enforcer || !(await bcrypt.compare(password, enforcer.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (enforcer.status === "pending") {
      return res.status(403).json({
        message: "Your account is still under review by the PlateTrack Administrator.",
      });
    }
    if (enforcer.status === "rejected") {
      // The reason is shown here because the sign-in message is how an
      // applicant finds out that the registration was declined and why.
      return res.status(403).json(rejectedReply(enforcer.rejectionReason));
    }

    const token = generateToken(enforcer._id, "enforcer", rememberDevice);
    return res.json({
      token,
      user: {
        id: enforcer._id,
        fullName: enforcer.fullName,
        email: enforcer.email,
        badgeNumber: enforcer.badgeNumber,
        station: enforcer.station,
        mobile: enforcer.mobile,
        createdAt: enforcer.createdAt,
        role: "enforcer",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login." });
  }
}

/* ----------------------------- OWNER ------------------------------ */

// POST /api/auth/owner/register
async function registerOwner(req, res) {
  try {
    const { fullName, email, vehicles, contactNumber, address, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Please fill in all required fields." });
    }

    if (!Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ message: "Please provide at least one vehicle." });
    }

    for (const v of vehicles) {
      if (!v || !v.plateNumber || !String(v.plateNumber).trim()) {
        return res.status(400).json({ message: "Please complete the plate number for each vehicle." });
      }
    }

    // Catch duplicate plates within the submitted list itself (e.g. the
    // same plate typed into two different vehicle rows, with or without
    // a space/dash, by mistake), before checking against everyone else's
    // registered vehicles. Compared on the fully-normalized form (bare
    // alphanumeric characters only) so "ABC1234" and "ABC 1234" are
    // correctly caught as the same plate, not two different ones.
    const normalizedPlates = vehicles.map((v) => normalizePlate(v.plateNumber));
    const hasInternalDuplicate = normalizedPlates.some((p, i) => normalizedPlates.indexOf(p) !== i);
    if (hasInternalDuplicate) {
      return res.status(400).json({ message: "Each vehicle must have a different plate number." });
    }

    // Flexible patterns, so "ABC1234", "ABC 1234", and "abc-1234" count as the
    // same plate when checking who already holds it.
    const plateRegexes = normalizedPlates
      .map((p) => buildFlexiblePlateRegex(p))
      .filter(Boolean);

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanAddress = typeof address === "string" ? address.trim().slice(0, 200) : "";

    // Who already holds this email or one of these plates -- as someone's
    // primary plate or as one of their additional vehicles?
    const holds = [
      { email: normalizedEmail },
      ...(plateRegexes.length
        ? [
            { plateNumber: { $in: plateRegexes } },
            { "additionalVehicles.plateNumber": { $in: plateRegexes } },
          ]
        : []),
    ];

    // Pending, approved, and flagged accounts keep their email and plates
    // reserved, so two owners can never claim the same plate.
    const blocking = await Owner.findOne({ status: { $ne: "rejected" }, $or: holds });
    if (blocking) {
      return res.status(409).json({ message: "An account with this email or one of these plate numbers already exists." });
    }

    // A REJECTED application does not keep anything reserved. That lets an
    // applicant who made a typing mistake register again, and lets the real
    // owner of a plate register it even if someone else's rejected application
    // used it first.
    const rejectedHolders = await Owner.find({ status: "rejected", $or: holds });
    const sameEmailRecord = rejectedHolders.find((o) => o.email === normalizedEmail) || null;
    const otherRejected = rejectedHolders.filter((o) => o !== sameEmailRecord);

    // Another rejected application that holds one of these plates is removed:
    // a plate number must be unique in the database, and a rejected applicant
    // has no access to the account anyway. Violations that pointed at the
    // removed record are re-linked below to the new owner when the plate
    // matches, otherwise they lose the owner link.
    const orphanedViolations = [];
    for (const old of otherRejected) {
      const linked = await Violation.find({ owner: old._id }).select("plateNumber");
      orphanedViolations.push(...linked);
      await Owner.deleteOne({ _id: old._id });
    }

    const [primaryVehicle, ...restVehicles] = vehicles;
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const details = {
      fullName,
      plateNumber: String(primaryVehicle.plateNumber).trim().toUpperCase(),
      vehicleType: primaryVehicle.vehicleType || "",
      vehicleColor: primaryVehicle.vehicleColor || "",
      additionalVehicles: restVehicles.map((v) => ({
        plateNumber: String(v.plateNumber).trim().toUpperCase(),
        vehicleType: v.vehicleType || "",
        vehicleColor: v.vehicleColor || "",
      })),
      contactNumber,
      address: cleanAddress,
      password: hashed,
    };

    let owner;
    let resubmitted = false;

    if (sameEmailRecord) {
      // Same email as a rejected application: the new details replace it and
      // the application goes back to pending, so the administrator reviews it
      // again from the start.
      owner = await Owner.findByIdAndUpdate(
        sameEmailRecord._id,
        { $set: { ...details, status: "pending", flagReason: null, reviewedBy: null, reviewedAt: null } },
        { new: true, runValidators: true }
      );
      resubmitted = true;
    } else {
      owner = await Owner.create({ ...details, email: normalizedEmail, status: "pending" });
    }

    for (const v of orphanedViolations) {
      const samePlate = plateRegexes.some((rx) => rx.test(v.plateNumber));
      await Violation.updateOne({ _id: v._id }, { $set: { owner: samePlate ? owner._id : null } });
    }

    return res.status(201).json({
      message: resubmitted
        ? "Your registration was submitted again and is pending review by the PlateTrack Administrator."
        : "Registration submitted and is pending review by the PlateTrack Administrator.",
      ownerId: owner._id,
      resubmitted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during registration." });
  }
}

// POST /api/auth/owner/login
async function loginOwner(req, res) {
  try {
    const { email, password, rememberDevice } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const owner = await Owner.findOne({ email: normalizedEmail });

    if (!owner || !(await bcrypt.compare(password, owner.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (owner.status === "pending") {
      return res.status(403).json({ message: "Your account is still under review by the PlateTrack Administrator." });
    }
    if (owner.status === "rejected") {
      // Same here: the owner's rejection reason is kept in flagReason.
      return res.status(403).json(rejectedReply(owner.flagReason));
    }

    const token = generateToken(owner._id, "owner", rememberDevice);
    return res.json({
      token,
      user: {
        id: owner._id,
        fullName: owner.fullName,
        email: owner.email,
        plateNumber: owner.plateNumber,
        vehicleType: owner.vehicleType,
        vehicleColor: owner.vehicleColor,
        additionalVehicles: owner.additionalVehicles,
        contactNumber: owner.contactNumber,
        address: owner.address,
        createdAt: owner.createdAt,
        role: "owner",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login." });
  }
}

/* ----------------------------- ADMIN ------------------------------ */

// POST /api/auth/admin/login
// Admin accounts are NOT self-registered through this API for security —
// create them with `npm run seed:admin` (see seed/createAdmin.js).
async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await Admin.findOne({ email: normalizedEmail });

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken(admin._id, "admin");
    return res.json({
      token,
      user: { id: admin._id, fullName: admin.fullName, email: admin.email, role: "admin" },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login." });
  }
}

module.exports = { registerEnforcer, loginEnforcer, registerOwner, loginOwner, loginAdmin };
