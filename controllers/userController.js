const userData = require('../models/userData');
const crypto = require('crypto');
const sendEmail = require('../utils/email'); // Replace with your email utility


// Controller for getting all Users
function getAllUsers(req, res) {
    const users = userData.getAllItems();
    res.json(users);
}

// Controller for getting a single User by ID
function getUserById(req, res) {
    const user = userData.getItemById(req.params.id);
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}


// Controller for adding a new User
function addUser(req, res) {
    const newUser = req.body;
    const addedUser = userData.addItem(newUser);
    res.status(201).json(addedUser);
}

// Controller for updating a User
function updateUser(req, res) {
    const updatedUser = userData.updateItem(req.params.id, req.body);
    if (updatedUser) {
        res.json(updatedUser);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}

// Controller for deleting a User
function deleteUser(req, res) {
    const isDeleted = userData.deleteItem(req.params.id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}

async function sendResetPasswordLink(req, res) {
    try {
      const { user_id, reset_email } = req.body; // Expecting both user_id and reset_email in the request body
  
      if (!user_id || !reset_email) {
        return res.status(400).json({ msg: 'User ID and Reset Email are required' });
      }
  
      // Find user by user_id
      const user = await userData.getItemById(user_id); // Assume userData has a method for finding users by ID
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }
  
      // Generate a reset token and set expiry
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = Date.now() + 3600000; // 1 hour
  
      // Update user data with reset token and expiry
      await userData.updateItem(user_id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: tokenExpiry,
      });
  
      // Create reset link
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
  
      // Send reset email to the provided reset_email
      const emailSubject = 'Password Reset Request';
      const emailBody = `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>
      `;
      await sendEmail(reset_email, emailSubject, emailBody); // Send email to reset_email
  
      res.status(200).json({ msg: 'Password reset link sent successfully' });
    } catch (error) {
      console.error('Error in sending reset password link:', error);
      res.status(500).json({ msg: 'An error occurred. Please try again.' });
    }
  }
  

module.exports = {
    getAllUsers,
    getUserById,
    addUser,
    updateUser,
    deleteUser,
    sendResetPasswordLink
};
