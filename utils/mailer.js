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

  // 👉 replace 56 with YOUR Brevo Template ID
  sendSmtpEmail.templateId = 8;

  // 👉 all dynamic fields you want to pass
  sendSmtpEmail.params = {
    username,
    amountUSD,
    coin,
    txHash: txHash || "N/A"
  };

  return apiInstance.sendTransacEmail(sendSmtpEmail);
}

async function sendWithdrawalRequestEmail({ to, username, amountUSD, method, details, withdrawalId }) {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  sendSmtpEmail.sender = { name: "BlockMinePro", email: "support@blockminepro.com" };
  sendSmtpEmail.to = [{ email: to }];

  sendSmtpEmail.templateId = 9;  // 🔹 use your real Brevo template ID

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

module.exports = { sendDepositApprovedEmail };
