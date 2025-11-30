const jwt = require('jsonwebtoken');
const logger = require('../logger');
const authController = require('./authController');
const operationAuthController = require('./operationAuthController');

function authMiddleware(req, res, next) {
    // Get the token from the Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Assuming format "Bearer <token>"

    if (!token) {
        return res.status(401).json({ msg: 'Authorization token missing' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, 'secretKey');
        
        // Check if user is blacklisted (force logout) - check both controllers
        const userEmail = decoded.email || decoded.phone; // JWT might have email or phone
        if (authController.isUserBlacklisted(userEmail) || operationAuthController.isUserBlacklisted(userEmail)) {
            logger.info(`User ${userEmail} is blacklisted - forcing logout`);
            return res.status(403).json({ msg: 'Your session has been terminated. Please log in again.' });
        }
        
        req.user = decoded; // Attach decoded user info to the request
        next(); // Continue to the next middleware or route handler
    } catch (error) {
        return res.status(403).json({ msg: 'Invalid or expired token' });
    }
}

module.exports = authMiddleware;
