// controllers/authController.js
const operationusersData = require('../models/operationusersData'); // Import operationusersData here
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sendEmail = require('../utils/email'); // Replace with your email utility
const logger = require('../logger');

// In-memory blacklist for testing - stores emails of users to force logout
const logoutBlacklist = new Set();



function login(req, res) {
    const { email, password } = req.body;
    logger.info("request: ", req.body);
    const user = operationusersData.findUserByEmailAndPassword(email,password);
    logger.info("info: ", user);
    const logintime = new Date().toISOString();
    logger.info("login time: ", logintime);
    
    if (user) {
      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ msg: 'User account is inactive' });
      }

      // Check if phone is registered
      if (!user.phone) {
        return res.status(200).json({ phoneRequired: true, userId: user._id, msg: 'Phone verification required.' });
      }
  
      // Create a JWT token with user information and expiration (24 hours)
      const authToken = jwt.sign(
        { email: user.email, role: user.role },
        'secretKey',
        { expiresIn: '24h' } // Token expires in 24 hours
      );
      
  
      // Extract IDs for authorized developers and projects from the user object
      // const developerIds = user.accessibleDevelopers || [];
      // const projectIds = user.accessibleProjects || []; 
      // const cameraIds = user.accessibleCameras || []; 
      // const services = user.accessibleServices || [];
      
      const updatedUser = operationusersData.updateItem(user._id, {"LastLoginTime":logintime});

  
      res.json({ 
        ... user,
        authh: authToken
      });
    } else {
      res.status(401).json({ msg: 'Invalid credentials' });
    }
}

// Controller for getting a single User by Email
function getUserByEmail(req, res) {
  const user = operationusersData.getUserByEmail(req.params.email);
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
  const user = operationusersData.getItemById(user_id);
  if (!user) {
    return res.status(404).json({ msg: 'User not found' });
  }

  // Generate a reset token and set expiry
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = Date.now() + 259200000; // 72 hour

  // Update user data with reset token and expiry
  const updateuser =  operationusersData.updateItem(user_id, {
    resetPasswordToken: resetToken,
    resetPasswordExpires: tokenExpiry,
    status: "Reset Password Sent"
  });
  logger.info("user: ", user_id);

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
        This link will expire in 3 days. If you did not request a password reset, you can safely ignore this email.
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

  const reset_email_send = reset_email.toLowerCase();
  const email = sendEmail(reset_email_send, emailSubject, emailBody); // Send email to reset_email
  
  if (email) {
    res.status(200).json({ msg: 'Password reset link sent successfully' });
  } else {
    logger.error('Error in sending reset password link:', error);
    res.status(500).json({ msg: 'An error occurred. Please try again.' });
  }

}

function resetPassword(req, res) {
 
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ msg: 'Token and new password are required' });
    }

    // Find user by token
    const user = operationusersData.getUserByToken(token);
   
    if (user.length === 0) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    // Check token expiry
    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ msg: 'Token has expired' });
    }

    // Hash the new password
    const hashedPassword = newPassword;

   
    const updated = operationusersData.updateItem(user[0]._id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      status: "Phone Required"
    });

    logger.info("updated: ",updated);

    res.status(200).json({ msg: 'Password reset successfully' });
  
}

// Test endpoint to force logout a specific user by email
function forceLogoutUser(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }

  const emailLower = email.toLowerCase();
  
  // Find user by email to verify they exist
  const user = operationusersData.getUserByEmail(emailLower);
  
  if (!user || user.length === 0) {
    return res.status(404).json({ msg: 'User not found' });
  }

  // Add email to blacklist
  logoutBlacklist.add(emailLower);
  logger.info(`User ${emailLower} added to logout blacklist`);

  res.status(200).json({ 
    msg: `User ${emailLower} will be logged out on their next request`,
    email: emailLower
  });
}

// Test endpoint to remove user from logout blacklist
function removeFromLogoutBlacklist(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }

  const emailLower = email.toLowerCase();
  logoutBlacklist.delete(emailLower);
  logger.info(`User ${emailLower} removed from logout blacklist`);

  res.status(200).json({ 
    msg: `User ${emailLower} removed from logout blacklist`,
    email: emailLower
  });
}

// Get logout blacklist (for testing/debugging)
function getLogoutBlacklist(req, res) {
  res.status(200).json({ 
    blacklistedEmails: Array.from(logoutBlacklist)
  });
}

// Export function to check if user is blacklisted (used by auth middleware)
function isUserBlacklisted(email) {
  if (!email) return false;
  return logoutBlacklist.has(email.toLowerCase());
}

module.exports = {
    login,
    getUserByEmail,
    sendResetPasswordLink,
    resetPassword,
    forceLogoutUser,
    removeFromLogoutBlacklist,
    getLogoutBlacklist,
    isUserBlacklisted
};