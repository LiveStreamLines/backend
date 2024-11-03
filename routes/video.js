const express = require('express');
const router = express.Router();
const videoController = require ('../controllers/videoController');

router.post('/', videoController.generateVideo());

module.exports = router;
