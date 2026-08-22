// Run with: npm run seed:admin
// Creates (or updates the password of) the initial admin account so you have
// a way to log in to the admin website for the first time.
require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  await connectDB();

  const fullName = await ask("Admin full name: ");
  const email = (await ask("Admin email: ")).trim().toLowerCase();
  const password = await ask("Admin password: ");

  const hashed = await bcrypt.hash(password, 10);

  const existing = await Admin.findOne({ email });
  if (existing) {
    existing.fullName = fullName;
    existing.password = hashed;
    await existing.save();
    console.log(`Updated existing admin: ${email}`);
  } else {
    await Admin.create({ fullName, email, password: hashed });
    console.log(`Created admin: ${email}`);
  }

  rl.close();
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
