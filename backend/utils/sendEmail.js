const nodemailer = require("nodemailer");

// Gmail SMTP transport. Requires a Gmail "App Password" (not the normal
// account password) — see .env.example for the link to generate one.
//
// `family: 4` forces IPv4 for this connection. Without it, some cloud
// hosts (Render included) try to reach Gmail's SMTP server over IPv6 and
// fail with "connect ENETUNREACH ..." even though the credentials are
// completely correct, because the host's network can't route to that
// IPv6 address at all.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  family: 4,
});

/**
 * Send an email.
 * @param {string} to - recipient email address
 * @param {string} subject
 * @param {string} html - HTML body
 */
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"${process.env.APP_NAME || "PlateTrack"}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[email] Sent "${subject}" to ${to}`);
  } catch (err) {
    // Don't crash the request if email fails — log it so the admin action
    // (e.g. saving the appeal status) still succeeds.
    console.error(`[email] Failed to send to ${to}:`, err.message);
  }
}

module.exports = sendEmail;
