const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

router.get('/conversations', chatController.getAllConversations);
router.get('/messages/:userId', chatController.getMessages);
router.get('/messages/conversation/:conversationId', chatController.getMessagesByConversationId);
router.post('/send', chatController.sendMessage);
router.post('/read/:userId', chatController.markAsRead);
router.put('/conversation/:userId/status', chatController.updateConversationStatus);
router.put('/conversation/id/:conversationId/status', chatController.updateConversationStatusById);
router.delete('/:id', chatController.deleteMessage);

module.exports = router;

