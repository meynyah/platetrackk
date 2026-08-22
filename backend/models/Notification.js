const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Who this notification is for
    recipientType: { type: String, enum: ["enforcer", "owner"], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "recipientModel" },
    recipientModel: { type: String, enum: ["Enforcer", "Owner"], required: true },

    type: {
      type: String,
      enum: [
        "announcement",
        "account_approved",
        "account_rejected",
        "appeal_under_review",
        "appeal_resolved",
        "violation_reported",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedAppeal: { type: mongoose.Schema.Types.ObjectId, ref: "Appeal", default: null },
    relatedViolation: { type: mongoose.Schema.Types.ObjectId, ref: "Violation", default: null },
    relatedAnnouncement: { type: mongoose.Schema.Types.ObjectId, ref: "Announcement", default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
