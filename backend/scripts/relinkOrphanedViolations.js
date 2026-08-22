// One-time repair script.
//
// Before the plate-matching fix, a violation filed with different
// spacing/dashes than how the owner registered (e.g. enforcer typed
// "JCG 5463" while the owner is registered as "JCG-5463") would save with
// owner: null, so it never showed up on the owner's "My Violations" page.
//
// This script finds violations with owner: null, tries to match them to an
// existing Owner using the same flexible plate matching the app now uses
// going forward, and links them. It only touches violations that currently
// have no owner — it will never overwrite an existing link.
//
// Usage (from the backend/ folder):
//   node scripts/relinkOrphanedViolations.js

require("dotenv").config();
const mongoose = require("mongoose");
const Violation = require("../models/Violation");
const Owner = require("../models/Owner");
const { buildFlexiblePlateRegex } = require("../utils/normalizePlate");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[relink] Connected to MongoDB.");

  const orphaned = await Violation.find({ owner: null });
  console.log(`[relink] Found ${orphaned.length} violation(s) with no linked owner.`);

  let relinked = 0;

  for (const violation of orphaned) {
    const regex = buildFlexiblePlateRegex(violation.plateNumber);
    if (!regex) continue;

    const owner = await Owner.findOne({ plateNumber: { $regex: regex } });
    if (!owner) continue;

    violation.owner = owner._id;
    await violation.save();
    relinked += 1;

    console.log(
      `[relink] Linked violation ${violation._id} (plate "${violation.plateNumber}") to owner ${owner.fullName} (${owner.plateNumber}).`
    );
  }

  console.log(`[relink] Done. Relinked ${relinked} of ${orphaned.length} orphaned violation(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[relink] Failed:", err);
  process.exit(1);
});
