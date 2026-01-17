// routes/weatherRoutes.js
const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

// Define the route for fetching weather data by time
router.get('/', weatherController.getWeatherByTime);

// Define the route for updating weather data from API
router.post('/update', weatherController.updateWeatherData);

module.exports = router;
