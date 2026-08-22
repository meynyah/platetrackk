const mongoose = require("mongoose");

const violationSchema = new mongoose.Schema(
  {
    enforcer: { type: mongoose.Schema.Types.ObjectId, ref: "Enforcer", required: true },
    plateNumber: { type: String, required: true, uppercase: true, trim: true },
    vehicleType: { type: String, trim: true, default: null },
    vehicleColor: { type: String, trim: true, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", default: null },
    violationType: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    dateTime: { type: Date, default: Date.now },
    photoUrl: { type: String, default: null },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "appealed", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Violation", violationSchema);
