const hikTokenData = require('../models/hikTokenData');
const logger = require('../logger');

// Controller for getting all Cameras
function getTokens(req, res) {
    const tokens = hikTokenData.getAllItems();
    res.json(tokens);
}


// Controller for adding a new Camera
function addToken(req, res) {
    const newTokens = req.body;
    hikTokenData.deleteAll();
    const addedToken = hikTokenData.addItem(newTokens);
    res.status(201).json(addedToken);
}

module.exports = {
    getTokens,
    addToken
};

