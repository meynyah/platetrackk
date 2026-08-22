const mongoose = require("mongoose");

const appealSchema = new mongoose.Schema(
  {
    violation: { type: mongoose.Schema.Types.ObjectId, ref: "Violation", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", required: true },
    reason: { type: String, required: true, trim: true },
    supportingDetails: { type: String, trim: true },
    status: {
      type: String,
      enum: ["submitted", "under_review", "approved", "denied"],
      default: "submitted",
    },
    adminFeedback: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appeal", appealSchema);
