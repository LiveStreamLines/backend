const jwt = require('jsonwebtoken');

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
        req.user = decoded; // Attach decoded user info to the request
        next(); // Continue to the next middleware or route handler
    } catch (error) {
        return res.status(403).json({ msg: 'Invalid or expired token' });
    }
}

module.exports = authMiddleware;
