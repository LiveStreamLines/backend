const nodemailer = require('nodemailer');
const sendEmail = async (to, subject, html) => {
    try {
      // Create transporter using SMTP
      const transporter = nodemailer.createTransport({
        host: 'smtp.titan.email', // Replace with your SMTP server
        port: 465, // Use 465 for SSL or 587 for TLS
        secure: true, // Use true for 465, false for other ports
        auth: {
          user: 'amar@livestreamlines.com', // Your email address
          pass: 'interQAZ@159', // Your password or app-specific password
        },
      });
  
      // Email options
      const mailOptions = {
        from: 'amar@livestreamlines.com', // Sender's address
        to, // Recipient's address
        subject, // Subject line
        html, // HTML body
      };
  
      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };
  
  module.exports = sendEmail;
