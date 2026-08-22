// Diagnostic script — prints the plate number on every owner-less
// violation, side by side with every registered owner's plate number, so
// we can see exactly why they aren't matching.
//
// Usage (from the backend/ folder):
//   node scripts/diagnosePlateMismatch.js

require("dotenv").config();
const mongoose = require("mongoose");
const Violation = require("../models/Violation");
const Owner = require("../models/Owner");
const { normalizePlate } = require("../utils/normalizePlate");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[diagnose] Connected to MongoDB.\n");

  const orphaned = await Violation.find({ owner: null }).select("plateNumber dateTime violationType");
  const owners = await Owner.find({}).select("fullName plateNumber status");

  console.log(`=== Registered Owners (${owners.length}) ===`);
  owners.forEach((o) => {
    console.log(
      `  "${o.plateNumber}"  ->  normalized: "${normalizePlate(o.plateNumber)}"  (${o.fullName}, status: ${o.status})`
    );
  });

  console.log(`\n=== Orphaned Violations (${orphaned.length}) ===`);
  orphaned.forEach((v) => {
    console.log(
      `  "${v.plateNumber}"  ->  normalized: "${normalizePlate(v.plateNumber)}"  (${v.violationType}, ${v.dateTime?.toISOString?.() || v.dateTime})`
    );
  });

  console.log("\n=== Comparison ===");
  orphaned.forEach((v) => {
    const target = normalizePlate(v.plateNumber);
    const match = owners.find((o) => normalizePlate(o.plateNumber) === target);
    if (match) {
      console.log(`  ✅ "${v.plateNumber}" SHOULD match owner "${match.plateNumber}" (${match.fullName})`);
    } else {
      console.log(`  ❌ "${v.plateNumber}" has no registered owner with a matching plate at all.`);
    }
  });

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[diagnose] Failed:", err);
  process.exit(1);
});
