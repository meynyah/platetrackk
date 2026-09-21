const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true }, // driver's license -- one per owner, used as an extra identity check at registration
    plateNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    vehicleType: { type: String, trim: true, default: "" },
    vehicleColor: { type: String, trim: true, default: "" },
    orCrNumber: { type: String, required: true, trim: true }, // Official Receipt/Certificate of Registration number for the primary vehicle -- an extra ownership check alongside the plate number

    // Multi-vehicle support: the fields above remain the owner's primary/
    // original registered vehicle (unchanged, so existing accounts and
    // the registration flow don't need to change at all). Any vehicles
    // added later from the dashboard go here instead.
    additionalVehicles: [
      {
        plateNumber: { type: String, required: true, uppercase: true, trim: true },
        vehicleType: { type: String, trim: true, default: "" },
        vehicleColor: { type: String, trim: true, default: "" },
        orCrNumber: { type: String, required: true, trim: true },
      },
    ],
    contactNumber: { type: String, trim: true },
    address: { type: String, trim: true, default: "" },
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
