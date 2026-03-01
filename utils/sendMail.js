const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendMail = async (to, subject, text) => {
  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_USER, // must be verified in SendGrid
      subject,
      text,
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.error("SendGrid Error:", error.response?.body || error);
    throw error;
  }
};

module.exports = sendMail;