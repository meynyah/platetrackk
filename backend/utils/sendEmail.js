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

// Wraps whatever content each controller passes in with a consistent,
// branded look -- table-based layout with inline styles throughout,
// since many email clients (Outlook especially) ignore <style> blocks
// and modern CSS (flexbox/grid), but reliably support basic HTML tables.
function buildEmailHtml(innerHtml) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">

        <tr>
          <td style="background:#3d6cff;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.3px;">
              &#128737; PlateTrack
            </span>
            <div style="color:#dce7ff;font-size:12px;margin-top:2px;">
              Antipolo City &mdash; License Plate Recognition System
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.6;">
            ${innerHtml}
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
            <div style="color:#9ca3af;font-size:12px;line-height:1.5;">
              This is an automated message from PlateTrack. Please do not reply to this email.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Send an email.
 * @param {string} to - recipient email address
 * @param {string} subject
 * @param {string} html - HTML body (gets wrapped in the PlateTrack branded template)
 * @returns {Promise<boolean>} true if the email was actually sent, false if it failed.
 *   Never throws -- existing callers that don't check the return value keep
 *   working exactly as before (fire-and-forget), while callers where actual
 *   delivery matters (e.g. a password reset code) can check it.
 */
async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"${process.env.APP_NAME || "PlateTrack"}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: buildEmailHtml(html),
    });
    console.log(`[email] Sent "${subject}" to ${to}`);
    return true;
  } catch (err) {
    // Don't crash the request if email fails — log it so the admin action
    // (e.g. saving the appeal status) still succeeds.
    console.error(`[email] Failed to send to ${to}:`, err.message);
    return false;
  }
}

module.exports = sendEmail;
