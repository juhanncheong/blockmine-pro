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
