const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plateNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    vehicleType: { type: String, trim: true, default: "" },
    vehicleColor: { type: String, trim: true, default: "" },
    contactNumber: { type: String, trim: true },
    password: { type: String, required: true }, // hashed
    status: {
      type: String,
      // "flagged" = admin marked the account as suspicious and worth a closer look
      enum: ["pending", "approved", "flagged", "rejected"],
      default: "pending",
    },
    flagReason: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Owner", ownerSchema);
