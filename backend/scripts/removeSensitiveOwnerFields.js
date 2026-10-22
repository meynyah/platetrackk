// One-time cleanup: permanently removes the driver's license number and the
// OR/CR numbers that owners entered earlier, now that PlateTrack no longer
// collects them. Removing the field from the form and the schema is NOT
// enough on its own -- the values already saved in MongoDB stay there until
// they are unset.
//
// Usage (from the backend/ folder, with MONGO_URI set in .env):
//   node scripts/removeSensitiveOwnerFields.js           -> dry run (only counts)
//   node scripts/removeSensitiveOwnerFields.js --apply   -> actually deletes
//
// Take a database backup/export first. This cannot be undone.

require("dotenv").config();
const mongoose = require("mongoose");
const Owner = require("../models/Owner");

async function run() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[cleanup] Connected to MongoDB.");

  // Use the native collection so the (now smaller) Mongoose schema cannot hide the old fields.
  const col = Owner.collection;

  const topLevel = await col.countDocuments({
    $or: [{ licenseNumber: { $exists: true } }, { orCrNumber: { $exists: true } }],
  });
  const nested = await col.countDocuments({ "additionalVehicles.orCrNumber": { $exists: true } });
  console.log(`[cleanup] Owners with licenseNumber/orCrNumber at top level: ${topLevel}`);
  console.log(`[cleanup] Owners with orCrNumber inside additionalVehicles:   ${nested}`);

  if (!apply) {
    console.log("[cleanup] DRY RUN -- nothing was changed. Re-run with --apply to delete these fields.");
  } else {
    const r1 = await col.updateMany({}, { $unset: { licenseNumber: "", orCrNumber: "" } });
    const r2 = await col.updateMany(
      { additionalVehicles: { $type: "array", $ne: [] } },
      { $unset: { "additionalVehicles.$[].orCrNumber": "" } }
    );
    console.log(`[cleanup] Top-level fields removed from ${r1.modifiedCount} owner(s).`);
    console.log(`[cleanup] Nested OR/CR removed from ${r2.modifiedCount} owner(s).`);

    const left = await col.countDocuments({
      $or: [
        { licenseNumber: { $exists: true } },
        { orCrNumber: { $exists: true } },
        { "additionalVehicles.orCrNumber": { $exists: true } },
      ],
    });
    console.log(`[cleanup] Owners that still have any of these fields: ${left} (should be 0)`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[cleanup] Failed:", err);
  process.exit(1);
});
