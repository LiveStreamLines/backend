const conversationData = require('../models/conversationData');
const userData = require('../models/userData');
const logger = require('../logger');

// Get user ID and info from request
const getUserInfo = (req) => {
    if (!req.user) {
        logger.warn('req.user is null in getUserInfo');
        return null;
    }
    
    const users = userData.getAllItems();
    
    // Try to find user by email (most common case)
    if (req.user.email) {
        const user = users.find(u => u.email && u.email.toLowerCase() === req.user.email.toLowerCase());
        if (user) {
            logger.info('Found user by email', { email: req.user.email, userId: user._id });
            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            };
        }
    }
    
    // Fallback to finding by ID
    if (req.user._id || req.user.id || req.user.userId) {
        const userId = req.user._id || req.user.id || req.user.userId;
        const user = users.find(u => u._id === userId);
        if (user) {
            logger.info('Found user by ID', { userId: userId });
            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            };
        }
    }
    
    // Log what we have for debugging
    logger.warn('Could not find user in getUserInfo', { 
        user: req.user, 
        hasEmail: !!req.user.email,
        totalUsers: users.length 
    });
    
    return null;
};

// Check if user is admin
const isAdmin = (role) => {
    return role === 'Super Admin' || role === 'Admin';
};

// Get or create conversation for a user
const getOrCreateConversation = (userId) => {
    const conversations = conversationData.getAllItems();
    let conversation = conversations.find(c => c.userId === userId);
    
    if (!conversation) {
        conversation = conversationData.addItem({
            userId: userId,
            status: 'open',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    return conversation;
};

// Get the most recent open conversation for a user
const getMostRecentOpenConversation = (userId) => {
    const conversations = conversationData.getAllItems();
    const userConversations = conversations
        .filter(c => c.userId === userId && c.status === 'open')
        .sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt).getTime();
            const bTime = new Date(b.updatedAt || b.createdAt).getTime();
            return bTime - aTime; // Most recent first
        });
    
    return userConversations.length > 0 ? userConversations[0] : null;
};

// Get all conversations
// For admins: see all user conversations
// For users: see only their own conversation
function getAllConversations(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            logger.warn('getUserInfo returned null in getAllConversations', { user: req.user });
            // Return empty conversations instead of 401 to avoid logout
            return res.json([]);
        }

        const allConversations = conversationData.getAllItems();
        const users = userData.getAllItems();
        const isUserAdmin = isAdmin(userInfo.role);
        
        const conversations = allConversations
            .filter(conv => {
                // For regular users, only show their own conversations
                if (!isUserAdmin && conv.userId !== userInfo._id) {
                    return false;
                }
                return true;
            })
            .map(conv => {
                const conversationUser = users.find(u => u._id === conv.userId);
                const messages = conv.messages || [];
                const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
                
                // Count unread messages
                let unreadCount = 0;
                if (isUserAdmin) {
                    // Admin counts unread messages from users
                    unreadCount = messages.filter(msg => 
                        msg.senderId === conv.userId && 
                        msg.receiverId === 'admin' && 
                        !msg.read
                    ).length;
                } else {
                    // User counts unread messages from admin
                    unreadCount = messages.filter(msg => 
                        msg.senderId === 'admin' && 
                        msg.receiverId === userInfo._id && 
                        !msg.read
                    ).length;
                }
                
                return {
                    conversationId: conv._id,
                    userId: conv.userId,
                    userName: conversationUser?.name || 'Unknown User',
                    userEmail: conversationUser?.email || '',
                    lastMessage: lastMessage,
                    unreadCount: unreadCount,
                    status: conv.status || 'open',
                    createdAt: conv.createdAt,
                    updatedAt: conv.updatedAt || conv.createdAt
                };
            })
            .sort((a, b) => {
                // Sort by last message time or updatedAt (newest first)
                const aTime = a.lastMessage?.createdAt || a.updatedAt || a.createdAt;
                const bTime = b.lastMessage?.createdAt || b.updatedAt || b.createdAt;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
        
        res.json(conversations);
    } catch (error) {
        logger.error('Error getting conversations', error);
        res.status(500).json({ message: 'Failed to get conversations' });
    }
}

// Get messages for a conversation
// For admins: get messages with a specific user
// For users: get messages with admin
function getMessages(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            logger.warn('getUserInfo returned null in getMessages', { user: req.user });
            // Return empty messages instead of 401 to avoid logout
            return res.json([]);
        }

        const isUserAdmin = isAdmin(userInfo.role);
        const conversationUserId = req.params.userId;
        
        if (!conversationUserId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Regular users can only see their own conversation
        if (!isUserAdmin && conversationUserId !== userInfo._id) {
            return res.status(403).json({ message: 'You can only view your own conversation' });
        }

        // For regular users, get the most recent open conversation
        // For admins, get the conversation by userId (they specify which conversation)
        let conversation;
        if (isUserAdmin) {
            conversation = getOrCreateConversation(conversationUserId);
        } else {
            // For users, get the most recent open conversation
            conversation = getMostRecentOpenConversation(conversationUserId);
            if (!conversation) {
                // If no open conversation exists, return empty messages
                return res.json([]);
            }
        }
        const users = userData.getAllItems();
        const messages = (conversation.messages || []).map(msg => {
            const sender = msg.senderId === 'admin' 
                ? { _id: 'admin', name: 'Admin', email: 'admin@system.com' }
                : users.find(u => u._id === msg.senderId);
            const receiver = msg.receiverId === 'admin'
                ? { _id: 'admin', name: 'Admin', email: 'admin@system.com' }
                : users.find(u => u._id === msg.receiverId);
            const replyToMessage = msg.replyTo ? conversation.messages.find(m => m._id === msg.replyTo) : null;
            
            return {
                ...msg,
                senderName: sender?.name || 'Unknown',
                receiverName: receiver?.name || 'Unknown',
                isFromAdmin: msg.senderId === 'admin',
                replyToMessage: replyToMessage ? {
                    _id: replyToMessage._id,
                    content: replyToMessage.content,
                    senderName: replyToMessage.senderId === 'admin' ? 'Admin' : 
                               (users.find(u => u._id === replyToMessage.senderId)?.name || 'Unknown')
                } : null
            };
        });

        // Mark messages as read
        let updated = false;
        messages.forEach(msg => {
            if (isUserAdmin) {
                // Admin reads messages from users
                if (msg.senderId === conversationUserId && msg.receiverId === 'admin' && !msg.read) {
                    msg.read = true;
                    msg.readAt = new Date().toISOString();
                    updated = true;
                }
            } else {
                // User reads messages from admin
                if (msg.senderId === 'admin' && msg.receiverId === userInfo._id && !msg.read) {
                    msg.read = true;
                    msg.readAt = new Date().toISOString();
                    updated = true;
                }
            }
        });

        // Save updated messages if any were marked as read
        if (updated) {
            conversationData.updateItem(conversation._id, {
                messages: messages.map(m => ({
                    _id: m._id,
                    senderId: m.senderId,
                    senderName: m.senderName,
                    receiverId: m.receiverId,
                    receiverName: m.receiverName,
                    content: m.content,
                    replyTo: m.replyTo,
                    read: m.read,
                    readAt: m.readAt,
                    createdAt: m.createdAt
                })),
                updatedAt: new Date().toISOString()
            });
        }

        res.json(messages);
    } catch (error) {
        logger.error('Error getting messages', error);
        res.status(500).json({ message: 'Failed to get messages' });
    }
}

// Get messages by conversation ID (for admins to get specific conversation)
function getMessagesByConversationId(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            logger.warn('getUserInfo returned null in getMessagesByConversationId', { user: req.user });
            return res.json([]);
        }

        const isUserAdmin = isAdmin(userInfo.role);
        const conversationId = req.params.conversationId;
        
        if (!conversationId) {
            return res.status(400).json({ message: 'Conversation ID is required' });
        }

        // Only admins can use this endpoint
        if (!isUserAdmin) {
            return res.status(403).json({ message: 'Only admins can access conversations by ID' });
        }

        // Find conversation by ID
        const conversations = conversationData.getAllItems();
        const conversation = conversations.find(c => c._id === conversationId);
        
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const users = userData.getAllItems();
        const messages = (conversation.messages || []).map(msg => {
            const sender = msg.senderId === 'admin' 
                ? { _id: 'admin', name: 'Admin', email: 'admin@system.com' }
                : users.find(u => u._id === msg.senderId);
            const receiver = msg.receiverId === 'admin'
                ? { _id: 'admin', name: 'Admin', email: 'admin@system.com' }
                : users.find(u => u._id === msg.receiverId);
            const replyToMessage = msg.replyTo ? conversation.messages.find(m => m._id === msg.replyTo) : null;
            
            return {
                ...msg,
                senderName: sender?.name || 'Unknown',
                receiverName: receiver?.name || 'Unknown',
                isFromAdmin: msg.senderId === 'admin',
                replyToMessage: replyToMessage ? {
                    _id: replyToMessage._id,
                    content: replyToMessage.content,
                    senderName: replyToMessage.senderId === 'admin' ? 'Admin' : 
                               (users.find(u => u._id === replyToMessage.senderId)?.name || 'Unknown')
                } : null
            };
        });

        // Mark messages as read (admin reading user messages)
        let updated = false;
        const updatedMessages = messages.map(msg => {
            if (msg.senderId === conversation.userId && msg.receiverId === 'admin' && !msg.read) {
                updated = true;
                return {
                    ...msg,
                    read: true,
                    readAt: new Date().toISOString()
                };
            }
            return msg;
        });

        // Save updated messages if any were marked as read
        if (updated) {
            conversationData.updateItem(conversation._id, {
                messages: updatedMessages.map(m => ({
                    _id: m._id,
                    senderId: m.senderId,
                    senderName: m.senderName,
                    receiverId: m.receiverId,
                    receiverName: m.receiverName,
                    content: m.content,
                    replyTo: m.replyTo,
                    read: m.read,
                    readAt: m.readAt,
                    createdAt: m.createdAt
                })),
                updatedAt: new Date().toISOString()
            });
            return res.json(updatedMessages);
        }

        res.json(messages);
    } catch (error) {
        logger.error('Error getting messages by conversation ID', error);
        res.status(500).json({ message: 'Failed to get messages' });
    }
}

// Send a message
// Users send to 'admin', admins send to specific userId
function sendMessage(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            logger.warn('getUserInfo returned null in sendMessage', { user: req.user });
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const { receiverId, content, replyTo } = req.body;
        const isUserAdmin = isAdmin(userInfo.role);

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        // Determine receiver
        let actualReceiverId;
        if (isUserAdmin) {
            // Admin sending to a user
            if (!receiverId) {
                return res.status(400).json({ message: 'Receiver ID is required for admin messages' });
            }
            actualReceiverId = receiverId;
        } else {
            // User sending to admin
            actualReceiverId = 'admin';
        }

        // Validate receiver exists (if not admin)
        if (actualReceiverId !== 'admin') {
            const users = userData.getAllItems();
            const receiver = users.find(u => u._id === actualReceiverId);
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }
        }

        // Get or create conversation
        const conversationUserId = isUserAdmin ? actualReceiverId : userInfo._id;
        let conversation;
        
        if (isUserAdmin) {
            // Admin: get the most recent open conversation for the user they're replying to
            // If no open conversation exists, get the most recent one (even if closed)
            conversation = getMostRecentOpenConversation(conversationUserId);
            if (!conversation) {
                // If no open conversation, get the most recent one (could be closed)
                const conversations = conversationData.getAllItems();
                const userConversations = conversations
                    .filter(c => c.userId === conversationUserId)
                    .sort((a, b) => {
                        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
                        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
                        return bTime - aTime; // Most recent first
                    });
                conversation = userConversations.length > 0 ? userConversations[0] : getOrCreateConversation(conversationUserId);
            }
        } else {
            // User: get the most recent open conversation, or create a new one if none exists
            conversation = getMostRecentOpenConversation(conversationUserId);
            if (!conversation) {
                // No open conversation exists, create a new one
                conversation = conversationData.addItem({
                    userId: conversationUserId,
                    status: 'open',
                    messages: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        // Validate replyTo if provided
        if (replyTo) {
            const replyToMsg = conversation.messages.find(m => m._id === replyTo);
            if (!replyToMsg) {
                return res.status(404).json({ message: 'Message to reply to not found' });
            }
        }

        // Generate message ID
        const generateMessageId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

        // Create new message
        const newMessage = {
            _id: generateMessageId(),
            senderId: userInfo._id,
            senderName: userInfo.name,
            receiverId: actualReceiverId,
            receiverName: actualReceiverId === 'admin' ? 'Admin' : 'User',
            content: content.trim(),
            replyTo: replyTo || null,
            read: false,
            createdAt: new Date().toISOString()
        };

        // Add message to conversation
        const updatedMessages = [...(conversation.messages || []), newMessage];
        
        // If admin sends to a closed conversation, reopen it
        const newStatus = isUserAdmin && conversation.status === 'closed' ? 'open' : conversation.status;
        
        conversationData.updateItem(conversation._id, {
            messages: updatedMessages,
            status: newStatus,
            updatedAt: new Date().toISOString()
        });

        res.status(201).json(newMessage);
    } catch (error) {
        logger.error('Error sending message', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
}

// Mark messages as read
function markAsRead(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            logger.warn('getUserInfo returned null in markAsRead', { user: req.user });
            // Return success with 0 count instead of 401
            return res.json({ message: 'Messages marked as read', count: 0 });
        }

        const conversationUserId = req.params.userId;
        if (!conversationUserId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const conversation = getOrCreateConversation(conversationUserId);
        const isUserAdmin = isAdmin(userInfo.role);
        const messages = conversation.messages || [];
        
        let unreadCount = 0;
        const updatedMessages = messages.map(msg => {
            let shouldMarkRead = false;
            
            if (isUserAdmin) {
                // Admin marking user messages as read
                if (msg.senderId === conversationUserId && msg.receiverId === 'admin' && !msg.read) {
                    shouldMarkRead = true;
                    unreadCount++;
                }
            } else {
                // User marking admin messages as read
                if (msg.senderId === 'admin' && msg.receiverId === userInfo._id && !msg.read) {
                    shouldMarkRead = true;
                    unreadCount++;
                }
            }
            
            if (shouldMarkRead) {
                return {
                    ...msg,
                    read: true,
                    readAt: new Date().toISOString()
                };
            }
            return msg;
        });

        if (unreadCount > 0) {
            conversationData.updateItem(conversation._id, {
                messages: updatedMessages,
                updatedAt: new Date().toISOString()
            });
        }

        res.json({ message: 'Messages marked as read', count: unreadCount });
    } catch (error) {
        logger.error('Error marking messages as read', error);
        res.status(500).json({ message: 'Failed to mark messages as read' });
    }
}

// Update conversation status (open/closed) by conversation ID
function updateConversationStatusById(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const isUserAdmin = isAdmin(userInfo.role);
        if (!isUserAdmin) {
            return res.status(403).json({ message: 'Only admins can update conversation status' });
        }

        const conversationId = req.params.conversationId;
        const { status } = req.body;

        if (!conversationId || !status) {
            return res.status(400).json({ message: 'Conversation ID and status are required' });
        }

        if (!['open', 'closed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "open" or "closed"' });
        }

        // Find conversation by ID
        const conversations = conversationData.getAllItems();
        const conversation = conversations.find(c => c._id === conversationId);
        
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        
        conversationData.updateItem(conversation._id, {
            status: status,
            updatedAt: new Date().toISOString()
        });

        res.json({ message: 'Conversation status updated', status, count: conversation.messages?.length || 0 });
    } catch (error) {
        logger.error('Error updating conversation status by ID', error);
        res.status(500).json({ message: 'Failed to update conversation status' });
    }
}

// Update conversation status (open/closed) by userId (legacy support)
function updateConversationStatus(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const isUserAdmin = isAdmin(userInfo.role);
        if (!isUserAdmin) {
            return res.status(403).json({ message: 'Only admins can update conversation status' });
        }

        const conversationUserId = req.params.userId;
        const { status } = req.body;

        if (!conversationUserId || !status) {
            return res.status(400).json({ message: 'User ID and status are required' });
        }

        if (!['open', 'closed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "open" or "closed"' });
        }

        // Get the most recent open conversation, or most recent if none open
        let conversation = getMostRecentOpenConversation(conversationUserId);
        if (!conversation) {
            const conversations = conversationData.getAllItems();
            const userConversations = conversations
                .filter(c => c.userId === conversationUserId)
                .sort((a, b) => {
                    const aTime = new Date(a.updatedAt || a.createdAt).getTime();
                    const bTime = new Date(b.updatedAt || b.createdAt).getTime();
                    return bTime - aTime; // Most recent first
                });
            conversation = userConversations.length > 0 ? userConversations[0] : getOrCreateConversation(conversationUserId);
        }
        
        conversationData.updateItem(conversation._id, {
            status: status,
            updatedAt: new Date().toISOString()
        });

        res.json({ message: 'Conversation status updated', status, count: conversation.messages?.length || 0 });
    } catch (error) {
        logger.error('Error updating conversation status', error);
        res.status(500).json({ message: 'Failed to update conversation status' });
    }
}

// Delete a message
function deleteMessage(req, res) {
    try {
        const userInfo = getUserInfo(req);
        if (!userInfo) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const messageId = req.params.id;
        const isUserAdmin = isAdmin(userInfo.role);
        
        // Find conversation containing this message
        const conversations = conversationData.getAllItems();
        let conversation = null;
        let message = null;
        
        for (const conv of conversations) {
            message = (conv.messages || []).find(m => m._id === messageId);
            if (message) {
                conversation = conv;
                break;
            }
        }

        if (!message || !conversation) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Only sender can delete their own message, or admin can delete any message
        if (message.senderId !== userInfo._id && !isUserAdmin) {
            return res.status(403).json({ message: 'You can only delete your own messages' });
        }

        // Remove message from conversation
        const updatedMessages = conversation.messages.filter(m => m._id !== messageId);
        
        conversationData.updateItem(conversation._id, {
            messages: updatedMessages,
            updatedAt: new Date().toISOString()
        });

        res.status(204).send();
    } catch (error) {
        logger.error('Error deleting message', error);
        res.status(500).json({ message: 'Failed to delete message' });
    }
}

module.exports = {
    getAllConversations,
    getMessages,
    getMessagesByConversationId,
    sendMessage,
    markAsRead,
    updateConversationStatus,
    updateConversationStatusById,
    deleteMessage
};
