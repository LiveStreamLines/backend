const loginHistoryData = require('../models/loginHistoryData');

exports.addLoginHistory = (req, res) => {
    const user = req.userlogin; // Assuming authMiddleware adds user info to req
    const newLoginRecord = {
        user: user,
        loginTime: new Date().toISOString(),
    };

    const savedRecord = loginHistoryData.addItem(newLoginRecord);
    res.status(201).json({ message: 'Login history recorded', record: savedRecord });
};

exports.getLoginHistoryByUser = (req, res) => {
    const userId = req.params.userId;
    const loginRecords = loginHistoryData.getAllItems().filter(record => record.userId === userId);
    res.status(200).json(loginRecords);
};
