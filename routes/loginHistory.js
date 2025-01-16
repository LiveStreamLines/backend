const express = require('express');
const router = express.Router();
const loginHistoryController = require('../controllers/loginHistoryController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

router.post('/', loginHistoryController.addLoginHistory);
router.get('/:userId', loginHistoryController.getLoginHistoryByUser);

module.exports = router;