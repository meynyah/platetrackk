const nodemailer = require("nodemailer");
const dns = require("dns").promises;

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;

// Render's containers have no outbound IPv6 route, and smtp.gmail.com has
// both an IPv4 (A) and IPv6 (AAAA) record. The obvious fix -- forcing IPv4
// -- turned out to need two layers, confirmed against production logs:
//
//   1. dns.setDefaultResultOrder("ipv4first") only changes the order for
//      dns.lookup() (the OS-level getaddrinfo call). It does NOT affect
//      nodemailer's own resolution, because nodemailer resolves SMTP
//      hostnames with the lower-level dns.resolve4()/dns.resolve6() (raw
//      DNS queries), falling back to dns.lookup() only if BOTH of those
//      fail. On Render's network, the resolve4() query itself silently
//      fails, so nodemailer falls through to resolve6() -- which
//      succeeds -- and hands back an IPv6 address that then can't be
//      reached at all (ENETUNREACH), even with the transporter's own
//      `family: 4` option, which only applies to nodemailer's internal
//      resolution, not to fixing resolve4() itself.
//
//   2. The fix that actually holds: resolve the hostname ourselves with
//      dns.lookup(host, { family: 4 }) -- which uses getaddrinfo and does
//      work correctly on Render -- and hand nodemailer the literal IP
//      address as `host`, skipping its internal DNS resolution entirely.
//      `tls.servername` is required alongside this so the certificate is
//      still validated against "smtp.gmail.com" rather than the raw IP.
//
// Resolved fresh (not cached at module load) so a change in Gmail's IP
// over time doesn't require a redeploy; the lookup itself is a fast local
// getaddrinfo call, not a network round trip.
async function createGmailTransporter() {
  const { address } = await dns.lookup(GMAIL_SMTP_HOST, { family: 4 });

  return nodemailer.createTransport({
    host: address,
    port: GMAIL_SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    tls: {
      servername: GMAIL_SMTP_HOST,
    },
    // Without these, nodemailer's defaults (multiple minutes) mean a slow
    // or unresponsive connection leaves the request -- and the person
    // staring at "Sending Verification Code..." -- hanging far longer
    // than is reasonable for a password-reset flow. Fail fast instead so
    // requestPasswordReset can report the honest "couldn't send" error
    // within seconds rather than minutes.
    connectionTimeout: 10000, // time to establish the TCP connection
    greetingTimeout: 10000,   // time to wait for Gmail's initial greeting
    socketTimeout: 15000,     // time to wait on an idle connection overall
  });
}

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
    const transporter = await createGmailTransporter();

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
