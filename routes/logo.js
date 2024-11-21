// routes/logoRoutes.js
const express = require('express');
const router = express.Router();
const logoController = require('../controllers/logoController');

// Define the route for serving logos
router.get('/:type/:filename', logoController.serveLogo);

module.exports = router;