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
    resetPassword
};