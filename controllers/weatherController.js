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
 * Determine weather status from weather.com API response
 * Returns: 'sunny', 'cloudy', 'partly-cloudy', 'rainy', 'snowy', 'foggy', 'stormy', or 'unknown'
 */
function getWeatherStatus(obs) {
    const wxPhrase = (obs.wx_phrase || '').toLowerCase();
    const wxIcon = obs.wx_icon || obs.icon_extd || 0;
    const clds = (obs.clds || '').toUpperCase();
    
    // Check wx_phrase first (most reliable)
    if (wxPhrase.includes('clear') || wxPhrase.includes('fair') || wxPhrase.includes('sunny')) {
        return 'sunny';
    }
    
    if (wxPhrase.includes('cloudy') || wxPhrase.includes('overcast')) {
        // Check if it's partly cloudy
        if (wxPhrase.includes('partly') || wxPhrase.includes('partially') || wxPhrase.includes('scattered')) {
            return 'partly-cloudy';
        }
        return 'cloudy';
    }
    
    if (wxPhrase.includes('rain') || wxPhrase.includes('shower') || wxPhrase.includes('drizzle')) {
        return 'rainy';
    }
    
    if (wxPhrase.includes('snow') || wxPhrase.includes('sleet')) {
        return 'snowy';
    }
    
    if (wxPhrase.includes('fog') || wxPhrase.includes('mist') || wxPhrase.includes('haze')) {
        return 'foggy';
    }
    
    if (wxPhrase.includes('thunder') || wxPhrase.includes('storm')) {
        return 'stormy';
    }
    
    // Fallback to icon codes if phrase is not available
    // Weather.com icon codes:
    // 1-4: Clear/Sunny
    // 5-6: Mostly Clear
    // 7-8: Partly Cloudy
    // 11-12: Mostly Cloudy
    // 13-14: Cloudy
    // 15-18: Rainy
    // 19-20: Stormy
    // 22-23: Snowy
    // 24-25: Foggy
    
    if (wxIcon >= 1 && wxIcon <= 4) {
        return 'sunny';
    }
    
    if (wxIcon >= 5 && wxIcon <= 6) {
        return 'partly-cloudy';
    }
    
    if (wxIcon >= 7 && wxIcon <= 8) {
        return 'partly-cloudy';
    }
    
    if (wxIcon >= 11 && wxIcon <= 14) {
        return 'cloudy';
    }
    
    if (wxIcon >= 15 && wxIcon <= 18) {
        return 'rainy';
    }
    
    if (wxIcon >= 19 && wxIcon <= 20) {
        return 'stormy';
    }
    
    if (wxIcon >= 22 && wxIcon <= 23) {
        return 'snowy';
    }
    
    if (wxIcon >= 24 && wxIcon <= 25) {
        return 'foggy';
    }
    
    // Check cloud cover code
    if (clds === 'CLR' || clds === 'SKC') {
        return 'sunny';
    }
    
    if (clds === 'FEW' || clds === 'SCT') {
        return 'partly-cloudy';
    }
    
    if (clds === 'BKN' || clds === 'OVC') {
        return 'cloudy';
    }
    
    // Default fallback
    return 'unknown';
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
            
            // Determine weather status
            const status = getWeatherStatus(obs);

            return {
                date: dateTime,
                temp: obs.temp,
                rh: obs.rh, // Relative humidity
                status: status // 'sunny', 'cloudy', 'partly-cloudy', 'rainy', 'snowy', 'foggy', 'stormy', or 'unknown'
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
