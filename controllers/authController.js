// controllers/authController.js
const jwt = require('jsonwebtoken');
const userData = require('../models/userData'); // Import usersData here
const bcrypt = require('bcrypt');

function login(req, res) {
    const { email, password } = req.body;
    const user = userData.findUserByEmailAndPassword(email,password);
  
    if (user) {
      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ msg: 'User account is inactive' });
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
        role: user.role,
        developers: developerIds,
        projects: projectIds, 
        cameras: cameraIds,
        services: services     
      });
    } else {
      res.status(401).json({ msg: 'Invalid credentials' });
    }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ msg: 'Token and new password are required' });
    }

    // Find user by token
    const user = await userData.findUserByToken(token);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    // Check token expiry
    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ msg: 'Token has expired' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password and clear the token
    await userData.updateUserById(user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    res.status(200).json({ msg: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ msg: 'An error occurred. Please try again.' });
  }
}

module.exports = {
    login,
    resetPassword
};