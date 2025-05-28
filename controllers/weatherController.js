// controllers/weatherController.js
const fs = require('fs');
const path = require('path');
const logger = require('../logger');


// Controller function to get weather by time
function getWeatherByTime(req, res) {
    const { time } = req.query;

    // Read the weather data from the JSON file
    fs.readFile(path.join(__dirname, '../data/weather.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Error reading weather data' });
        }

        const weatherData = JSON.parse(data);

        // Find the weather data for the requested time
        const result = weatherData.find(item => item.date === time);

        if (result) {
            return res.json(result);
        } else {
            return res.status(404).json({ message: 'Weather data not found for this time' });
        }
    });
};

module.exports = {
   getWeatherByTime
};
