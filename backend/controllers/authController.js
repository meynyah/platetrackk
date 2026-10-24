const bcrypt = require("bcryptjs");
const Enforcer = require("../models/Enforcer");
const Owner = require("../models/Owner");
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

    const existing = await Enforcer.findOne({
      $or: [
        { email: normalizedEmail },
        { badgeNumber: normalizedBadgeNumber }
      ]
    });

    if (existing) {
      return res.status(409).json({
        message: "An account with this email or badge number already exists."
      });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const enforcer = await Enforcer.create({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      badgeNumber: normalizedBadgeNumber,
      station: String(station || "").trim() || "Antipolo Traffic Management Office",
      mobile: mobile || undefined,
      password: hashed,
      status: "pending"
    });

    return res.status(201).json({
      message: "Registration submitted. Your registration will be reviewed by the PlateTrack Administrator. You can only sign in after your account has been approved.",
      enforcerId: enforcer._id
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error during registration."
    });
  }
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
      return res.status(403).json({
        message: "Your registration was not approved. Contact the PlateTrack Administrator for details.",
      });
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

    // Check email and every submitted plate -- against both other
    // owners' primary plate AND their additionalVehicles -- in a single
    // query, the same comprehensive check ownerController's isPlateTaken
    // uses for adding a vehicle after registration.
    const plateRegexes = normalizedPlates
      .map((p) => buildFlexiblePlateRegex(p))
      .filter(Boolean);

    const existing = await Owner.findOne({
      $or: [
        { email },
        ...(plateRegexes.length
          ? [
              { plateNumber: { $in: plateRegexes } },
              { "additionalVehicles.plateNumber": { $in: plateRegexes } },
            ]
          : []),
      ],
    });
    if (existing) {
      return res.status(409).json({ message: "An account with this email or one of these plate numbers already exists." });
    }

    const [primaryVehicle, ...restVehicles] = vehicles;

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const owner = await Owner.create({
      fullName,
      email,
      plateNumber: primaryVehicle.plateNumber,
      vehicleType: primaryVehicle.vehicleType,
      vehicleColor: primaryVehicle.vehicleColor,
      additionalVehicles: restVehicles.map((v) => ({
        plateNumber: v.plateNumber,
        vehicleType: v.vehicleType || "",
        vehicleColor: v.vehicleColor || "",
      })),
      contactNumber,
      address: typeof address === "string" ? address.trim().slice(0, 200) : "",
      password: hashed,
      status: "pending",
    });

    return res.status(201).json({
      message: "Registration submitted and is pending review by the PlateTrack Administrator.",
      ownerId: owner._id,
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
      return res.status(403).json({ message: "Your registration was not approved." });
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
