/**
 * Notification service: email (Nodemailer) + Google Chat webhook.
 *
 * Configuration via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS  – Nodemailer SMTP
 *   NOTIFY_FROM   – sender address (defaults to SMTP_USER)
 *   NOTIFY_CC     – optional CC address for all booking notifications
 *   GOOGLE_CHAT_WEBHOOK_URL – Google Chat incoming webhook URL
 *
 * If the env vars are not set, notifications are silently skipped (dev-friendly).
 */

const nodemailer = require('nodemailer');

// ── Transporter ───────────────────────────────────────────────────────────────

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // Not configured – skip silently

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// ── Email helpers ─────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) return; // Not configured

  const mailOptions = {
    from: process.env.NOTIFY_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  };
  if (process.env.NOTIFY_CC) mailOptions.cc = process.env.NOTIFY_CC;

  try {
    await t.sendMail(mailOptions);
  } catch (err) {
    console.error('[Notifications] Email send failed:', err.message);
  }
}

// ── Google Chat webhook ───────────────────────────────────────────────────────

async function sendGoogleChatMessage(text) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) return; // Not configured

  try {
    const https = require('https');
    const url = new URL(webhookUrl);
    const body = JSON.stringify({ text });
    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        },
        (res) => {
          res.resume();
          res.on('end', resolve);
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    console.error('[Notifications] Google Chat webhook failed:', err.message);
  }
}

// ── Notification templates ────────────────────────────────────────────────────

/**
 * Notify when a new booking is created.
 * @param {object} booking - booking object
 * @param {object} resource - resource object
 */
async function notifyBookingCreated(booking, resource) {
  const subject = `📚 New Chromebook Booking – ${resource.name}`;
  const body = [
    `A new Chromebook booking has been created.`,
    ``,
    `Resource: ${resource.name} (${resource.classRoom})`,
    `Borrower: ${booking.borrower} (${booking.borrowerClass})`,
    `Quantity: ${booking.quantity}`,
    `From:  ${new Date(booking.startTime).toLocaleString()}`,
    `Until: ${new Date(booking.endTime).toLocaleString()}`,
    booking.notes ? `Notes: ${booking.notes}` : '',
    ``,
    `Booking ID: ${booking.id}`,
  ].filter((l) => l !== '').join('\n');

  await Promise.all([
    sendEmail({ to: process.env.NOTIFY_TO || '', subject, text: body }),
    sendGoogleChatMessage(`${subject}\n${body}`),
  ]);
}

/**
 * Notify when a booking is marked as returned.
 */
async function notifyBookingReturned(booking, resource) {
  const subject = `✅ Chromebook Returned – ${resource.name}`;
  const body = [
    `A Chromebook booking has been marked as returned.`,
    ``,
    `Resource: ${resource.name} (${resource.classRoom})`,
    `Borrower: ${booking.borrower} (${booking.borrowerClass})`,
    `Returned at: ${new Date(booking.actualReturnTime).toLocaleString()}`,
    `Booking ID: ${booking.id}`,
  ].join('\n');

  await Promise.all([
    sendEmail({ to: process.env.NOTIFY_TO || '', subject, text: body }),
    sendGoogleChatMessage(`${subject}\n${body}`),
  ]);
}

/**
 * Notify about overdue bookings (call periodically, e.g. every hour).
 * @param {Array<{booking, resource}>} overdueList
 */
async function notifyOverdueBookings(overdueList) {
  if (!overdueList.length) return;

  const subject = `⚠️ Overdue Chromebook Bookings (${overdueList.length})`;
  const lines = overdueList.map(
    ({ booking, resource }) =>
      `• ${resource.name}: ${booking.borrower} (${booking.borrowerClass}) – ended ${new Date(booking.endTime).toLocaleString()}`
  );
  const body = [`The following bookings are overdue:`, '', ...lines].join('\n');

  await Promise.all([
    sendEmail({ to: process.env.NOTIFY_TO || '', subject, text: body }),
    sendGoogleChatMessage(`${subject}\n${body}`),
  ]);
}

module.exports = {
  notifyBookingCreated,
  notifyBookingReturned,
  notifyOverdueBookings,
  sendEmail,
  sendGoogleChatMessage,
};
