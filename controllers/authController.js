// controllers/authController.js
const userData = require('../models/userData'); // Import usersData here
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sendEmail = require('../utils/email'); // Replace with your email utility


function login(req, res) {
    const { email, password } = req.body;
    const user = userData.findUserByEmailAndPassword(email,password);
  
    if (user) {
      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ msg: 'User account is inactive' });
      }

      // Check if phone is registered
      if (!user.phone) {
        return res.status(200).json({ phoneRequired: true, userId: user._id, msg: 'Phone verification required.' });
      }
  
      // Create a JWT token with user information
      const authToken = jwt.sign(
        { email: user.email, role: user.role },
        'secretKey'
      );
      
  
      // Extract IDs for authorized developers and projects from the user object
      const developerIds = user.accessibleDevelopers || [];
      const projectIds = user.accessibleProjects || []; 
      const cameraIds = user.accessibleCameras || []; 
      const services = user.accessibleServices || [];
      
  
      res.json({ 
        authh: authToken, 
        userId: user._id,
        username: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        developers: developerIds,
        projects: projectIds, 
        cameras: cameraIds,
        services: services,
        canAdduser: user.canAddUser,
        canGenerateVideoAndPics: user.canGenerateVideoAndPics,
        manual: user.manual
      });
    } else {
      res.status(401).json({ msg: 'Invalid credentials' });
    }
}

// Controller for getting a single User by Email
function getUserByEmail(req, res) {
  const user = userData.getUserByEmail(req.params.email);
  if (user) {
      res.json(user[0]._id);
  } else {
      res.status(404).json({ message: 'User not found' });
  }
}

function sendResetPasswordLink(req, res) {

  const { user_id, reset_email } = req.body; // Expecting both user_id and reset_email in the request body

  if (!user_id || !reset_email) {
    return res.status(400).json({ msg: 'User ID and Reset Email are required' });
  }

  // Find user by user_id
  const user = userData.getItemById(user_id); // Assume userData has a method for finding users by ID
  if (!user) {
    return res.status(404).json({ msg: 'User not found' });
  }

  // Generate a reset token and set expiry
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = Date.now() + 3600000; // 1 hour

  // Update user data with reset token and expiry
  const updateuser =  userData.updateItem(user_id, {
    resetPasswordToken: resetToken,
    resetPasswordExpires: tokenExpiry,
  });
  console.log(user_id);

  // Create reset link
  const resetLink = `https://lsl-platform.com/reset-password/${resetToken}`;

  // Send reset email to the provided reset_email
  const emailSubject = 'Password Reset Request';
  const emailBody = `
  <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
    <!-- Header Section with Logo -->
    <div style="background: #710707; padding: 20px; text-align: center;">
      <img src="https://lsl-platform.com/backend/logos/developer/3e7b411f42082d860818cbad.png" alt="Company Logo" style="max-height: 50px;">
    </div>

    <!-- Main Content Section -->
    <div style="padding: 20px; color: #333;">
      <h2 style="color: #710707;">Password Reset Request</h2>
      <p style="line-height: 1.6;">
        <b>Dear ${user.name}:</b><br/>
        You requested a password reset. Click the link below to reset your password:
      </p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="${resetLink}" style="background: #710707; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          Reset Your Password
        </a>
      </p>
      <p style="line-height: 1.6; color: #555;">
        This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer Section -->
    <div style="background: #f4f4f4; padding: 10px 20px; text-align: center; color: #888; font-size: 12px;">
      <p style="margin: 0;">© 2024 Live Stream Lines LLC</p>
      <p style="margin: 0;">712, Clover Bay Tower, Marasi Dr, Business Bay, Dubai, UAE</p>
      <p style="margin: 0;">Level 18, Faisaliah Tower, King Fahad Highway, 
      Olaya District P.O. Box 54995, Riyadh, kingdom of saudi arabia</p>
    </div>
  </div>
`;

  reset_email = reset_email.toLowerCase();
  const email = sendEmail(reset_email, emailSubject, emailBody); // Send email to reset_email
  
  if (email) {
    res.status(200).json({ msg: 'Password reset link sent successfully' });
  } else {
    console.error('Error in sending reset password link:', error);
    res.status(500).json({ msg: 'An error occurred. Please try again.' });
  }

}

function resetPassword(req, res) {
 
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ msg: 'Token and new password are required' });
    }

    // Find user by token
    const user = userData.getUserByToken(token);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    // Check token expiry
    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ msg: 'Token has expired' });
    }

    // Hash the new password
    const hashedPassword = newPassword;

    // Update the user's password and clear the token
    console.log(user);
    console.log(user[0]._id);

    const updated = userData.updateItem(user[0]._id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    console.log(updated);

    res.status(200).json({ msg: 'Password reset successfully' });
  
}

module.exports = {
    login,
    getUserByEmail,
    sendResetPasswordLink,
    resetPassword
};