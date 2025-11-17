const brevo = require("@getbrevo/brevo");

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// ======================
// Deposit Approved Email
// ======================
async function sendDepositApprovedEmail({ to, username, amountUSD, coin, txHash }) {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = { name: "BlockMinePro", email: "support@blockminepro.com" };
  sendSmtpEmail.to = [{ email: to }];

  sendSmtpEmail.templateId = 8;

  sendSmtpEmail.params = {
    username,
    amountUSD,
    coin,
    txHash: txHash || "N/A"
  };

  return apiInstance.sendTransacEmail(sendSmtpEmail);
}

// ===========================
// Withdrawal Request Email
// ===========================
async function sendWithdrawalRequestEmail({ to, username, amountUSD, method, details, withdrawalId }) {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = { name: "BlockMinePro", email: "support@blockminepro.com" };
  sendSmtpEmail.to = [{ email: to }];

  sendSmtpEmail.templateId = 9;

  sendSmtpEmail.params = {
    username,
    amountUSD,
    method,
    details,
    withdrawalId
  };

  return apiInstance.sendTransacEmail(sendSmtpEmail);
}

module.exports = {
  sendDepositApprovedEmail,
  sendWithdrawalRequestEmail
};
