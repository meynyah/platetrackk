const mongoose = require("mongoose");

const enforcerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please Enter a valid email address",
      ],
    },
    badgeNumber: { type: String, required: true, unique: true, trim: true },
    station: { type: String, trim: true },
    mobile: {
      type: String,
      trim: true,
      match: [/^09\d{9}$/, "Please enter a valid 11-digit Philippine mobile number"],
    },
    password: { type: String, required: true }, // hashed
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },

    // Real, backend-enforced duty status -- used to prevent an approved
    // enforcer from using plate detection or filing violations outside
    // their actual duty hours. Defaults to off-duty; the enforcer must
    // explicitly toggle this on each time they start their shift.
    onDuty: { type: Boolean, default: false },
    dutyChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Enforcer", enforcerSchema);
