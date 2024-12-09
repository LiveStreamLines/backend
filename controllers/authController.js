// controllers/authController.js
const jwt = require('jsonwebtoken');
const userData = require('../models/userData'); // Import usersData here


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
      
  
      res.json({ 
        authh: authToken, 
        role: user.role,
        developers: developerIds,
        projects: projectIds, 
        cameras: cameraIds        
      });
    } else {
      res.status(401).json({ msg: 'Invalid credentials' });
    }
}

module.exports = {
    login
};