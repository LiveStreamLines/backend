// routes/weatherRoutes.js
const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

// Define the route for fetching weather data by time
router.get('/', weatherController.getWeatherByTime);

module.exports = router;
