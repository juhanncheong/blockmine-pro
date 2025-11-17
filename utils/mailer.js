const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendDepositApprovedEmail({ to, username, amountUSD, coin, txHash }) {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = { name: "BlockMinePro", email: "support@blockminepro.com" };
  sendSmtpEmail.to = [{ email: to }];

  sendSmtpEmail.subject = "Your Deposit Has Been Approved ✔";
  sendSmtpEmail.htmlContent = `
    <h2>Deposit Approved</h2>
    <p>Hi ${username},</p>
    <p>Your deposit has been verified and credited to your account.</p>
    <ul>
      <li><strong>Amount:</strong> $${amountUSD}</li>
      <li><strong>Coin:</strong> ${coin}</li>
      <li><strong>TxHash:</strong> ${txHash || "N/A"}</li>
    </ul>
    <p>You can now start mining immediately.</p>
    <br/>
    <p>— BlockMinePro Team</p>
  `;

  return apiInstance.sendTransacEmail(sendSmtpEmail);
}

module.exports = { sendDepositApprovedEmail };
