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
        username: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        developers: developerIds,
        projects: projectIds, 
        cameras: cameraIds,
        services: services,
        canAdduser: user.canAddUser,
        canGenerateVideoAndPics: user.canGenerateVideoAndPics
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

  // Create reset link
  const resetLink = `${req.protocol}://5.9.85.250:4200/reset-password/${resetToken}`;

  // Send reset email to the provided reset_email
  const emailSubject = 'Password Reset Request';
  const emailBody = `
    <p>You requested a password reset.</p>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>This link will expire in 1 hour.</p>
  `;
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