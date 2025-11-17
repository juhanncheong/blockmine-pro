// utils/mailer.js
const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_NAME,
  SMTP_FROM_EMAIL,
} = process.env;

// One shared transporter for the whole app
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: false, // Brevo uses STARTTLS on 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Send "Deposit approved" email
 */
async function sendDepositApprovedEmail({ to, username, amountUSD, coin, txHash }) {
  if (!to) return;

  const subject = "Your BlockMinePro deposit has been approved";

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height:1.6; color:#111827;">
      <h2 style="color:#059669; margin-bottom:4px;">Deposit confirmed ✅</h2>
      <p>Hi ${username || ""},</p>
      <p>Good news — your deposit has been approved and added to your BlockMinePro balance.</p>

      <table style="border-collapse: collapse; margin:16px 0;">
        <tr>
          <td style="padding:4px 12px; font-weight:600;">Amount (USD)</td>
          <td style="padding:4px 12px;">$${Number(amountUSD || 0).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px; font-weight:600;">Coin</td>
          <td style="padding:4px 12px;">${coin || "-"}</td>
        </tr>
        ${
          txHash
            ? `<tr>
                 <td style="padding:4px 12px; font-weight:600;">Tx Hash</td>
                 <td style="padding:4px 12px; word-break:break-all;">${txHash}</td>
               </tr>`
            : ""
        }
      </table>

      <p>You can now start mining or purchase a package in your dashboard.</p>

      <p style="margin-top:24px;">Best regards,<br/>${SMTP_FROM_NAME || "BlockMinePro"} Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME || "BlockMinePro"}" <${SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}

module.exports = {
  sendDepositApprovedEmail,
};
