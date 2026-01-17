// controllers/weatherController.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../logger');

const WEATHER_API_KEY = 'e1f10a1e78da46f5b10a1e78da96f525';
const UAE_LOCATION_CODE = 'OMDB:9:AE'; // Dubai, UAE

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
}

/**
 * Convert GMT timestamp to GMT+4 (UAE time)
 */
function convertGMTtoGMT4(gmtTimestamp) {
    // valid_time_gmt is in seconds, convert to milliseconds
    const gmtDate = new Date(gmtTimestamp * 1000);
    // Add 4 hours (4 * 60 * 60 * 1000 milliseconds)
    const gmt4Date = new Date(gmtDate.getTime() + (4 * 60 * 60 * 1000));
    return gmt4Date.toISOString();
}

/**
 * Determine if weather is sunny or cloudy based on icon
 * wx_icon values: Clear/sunny typically < 10, cloudy typically >= 20
 */
function isSunny(wxIcon) {
    // Icons 1-4 are typically clear/sunny, 20+ are cloudy
    return wxIcon < 10;
}

/**
 * Fetch weather data from weather.com API for UAE
 */
function fetchWeatherData(startDate, endDate) {
    return new Promise((resolve, reject) => {
        const url = `https://api.weather.com/v1/location/${UAE_LOCATION_CODE}/observations/historical.json?apiKey=${WEATHER_API_KEY}&units=e&startDate=${startDate}&endDate=${endDate}`;
        
        https.get(url, (res) => {
            let data = '';

            // Check for HTTP errors
            if (res.statusCode !== 200) {
                return reject(new Error(`API returned status code ${res.statusCode}`));
            }

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    // Check if API returned an error in the response
                    if (response.metadata && response.metadata.status_code !== 200) {
                        return reject(new Error(`API error: Status code ${response.metadata.status_code}`));
                    }
                    
                    resolve(response);
                } catch (err) {
                    reject(new Error(`Failed to parse API response: ${err.message}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`API request failed: ${err.message}`));
        });
    });
}

/**
 * Update weather data from weather.com API
 */
async function updateWeatherData(req, res) {
    try {
        // Calculate date range: last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // Format dates as YYYYMMDD
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        };

        const startDateStr = formatDate(startDate);
        const endDateStr = formatDate(endDate);

        logger.info(`Fetching weather data from ${startDateStr} to ${endDateStr}`);

        // Fetch data from API
        const apiResponse = await fetchWeatherData(startDateStr, endDateStr);

        if (!apiResponse.observations || !Array.isArray(apiResponse.observations)) {
            throw new Error('Invalid API response: observations array not found');
        }

        // Process observations
        const weatherData = apiResponse.observations.map(obs => {
            // Convert GMT to GMT+4
            const dateTime = convertGMTtoGMT4(obs.valid_time_gmt);
            
            // Determine sunny/cloudy
            const sunny = isSunny(obs.wx_icon || obs.icon_extd);

            return {
                date: dateTime,
                temp: obs.temp,
                rh: obs.rh, // Relative humidity
                sunny: sunny
            };
        });

        // Read existing weather data
        const weatherFilePath = path.join(__dirname, '../data/weather.json');
        let existingData = [];

        try {
            const existingFileContent = fs.readFileSync(weatherFilePath, 'utf8');
            existingData = JSON.parse(existingFileContent);
        } catch (err) {
            // File doesn't exist or is invalid, start with empty array
            logger.info('Creating new weather.json file');
        }

        // Create a map of existing data by date for efficient lookup
        const existingDataMap = new Map();
        existingData.forEach(item => {
            existingDataMap.set(item.date, item);
        });

        // Merge new data with existing data
        weatherData.forEach(newItem => {
            existingDataMap.set(newItem.date, newItem);
        });

        // Convert map back to array and sort by date
        const mergedData = Array.from(existingDataMap.values()).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Write updated data to file
        fs.writeFileSync(weatherFilePath, JSON.stringify(mergedData, null, 2), 'utf8');

        logger.info(`Weather data updated successfully. Total records: ${mergedData.length}`);

        res.json({
            success: true,
            message: 'Weather data updated successfully',
            recordsAdded: weatherData.length,
            totalRecords: mergedData.length
        });

    } catch (error) {
        logger.error(`Error updating weather data: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Error updating weather data',
            error: error.message
        });
    }
}

module.exports = {
   getWeatherByTime,
   updateWeatherData
};
