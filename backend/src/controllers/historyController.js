import ChatSession from '../models/ChatSession.js';
import ChatHistory from '../models/ChatHistory.js';
import {responseHandler} from '../utils/responseHandler.js';
import logger from '../utils/logger.js';

class HistoryController {
    // Get chat history for a session
    async getChatHistory(req, res) {
        try {
            const { sessionId } = req.params;
            const { page = 1, limit = 50, before } = req.query;
            
            // Verify session belongs to user
            const session = await ChatSession.findOne({
                _id: sessionId,
                user: req.user._id
            });
            
            if (!session) {
                return responseHandler.notFound(res, 'Chat session not found');
            }
            
            // Build query
            const query = { session: sessionId, user: req.user._id };
            if (before) {
                query.createdAt = { $lt: new Date(before) };
            }
            
            const messages = await ChatHistory.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .select('-__v')
                .lean();
            
            // Reverse to chronological order
            messages.reverse();
            
            const total = await ChatHistory.countDocuments(query);
            
            logger.info(`Chat history retrieved for session ${sessionId}: ${messages.length} messages`);
            
            return responseHandler.success(res, 'Chat history retrieved', {
                session: {
                    id: session._id,
                    title: session.title,
                    model: session.modelUsed,
                    messageCount: session.messageCount
                },
                messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit),
                    hasMore: (page * limit) < total
                }
            });
            
        } catch (error) {
            logger.error('Get chat history error:', error);
            return responseHandler.serverError(res, 'Failed to retrieve chat history');
        }
    }

    // Clear chat history for a session
    async clearChatHistory(req, res) {
        try {
            const { sessionId } = req.params;
            
            // Verify session belongs to user
            const session = await ChatSession.findOne({
                _id: sessionId,
                user: req.user._id
            });
            
            if (!session) {
                return responseHandler.notFound(res, 'Chat session not found');
            }
            
            // Delete all messages in session
            const result = await ChatHistory.deleteMany({
                session: sessionId,
                user: req.user._id
            });
            
            // Reset session counters
            session.messageCount = 0;
            session.tokenCount = 0;
            await session.save();
            
            logger.info(`Chat history cleared for session ${sessionId}: ${result.deletedCount} messages deleted`);
            
            return responseHandler.success(res, 'Chat history cleared', {
                sessionId: session._id,
                deletedCount: result.deletedCount,
                messageCount: session.messageCount
            });
            
        } catch (error) {
            logger.error('Clear chat history error:', error);
            return responseHandler.serverError(res, 'Failed to clear chat history');
        }
    }

    // Delete specific message
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            
            const message = await ChatHistory.findOneAndDelete({
                _id: messageId,
                user: req.user._id
            });
            
            if (!message) {
                return responseHandler.notFound(res, 'Message not found');
            }
            
            // Update session message count
            await ChatSession.findByIdAndUpdate(message.session, {
                $inc: { messageCount: -1 }
            });
            
            logger.info(`Message deleted: ${messageId} by user ${req.user._id}`);
            
            return responseHandler.success(res, 'Message deleted', {
                messageId: message._id,
                sessionId: message.session
            });
            
        } catch (error) {
            logger.error('Delete message error:', error);
            return responseHandler.serverError(res, 'Failed to delete message');
        }
    }

    // Export chat history
    async exportChatHistory(req, res) {
        try {
            const { sessionId } = req.params;
            const { format = 'json' } = req.query;
            
            // Verify session belongs to user
            const session = await ChatSession.findOne({
                _id: sessionId,
                user: req.user._id
            });
            
            if (!session) {
                return responseHandler.notFound(res, 'Chat session not found');
            }
            
            // Get all messages
            const messages = await ChatHistory.find({
                session: sessionId,
                user: req.user._id
            })
            .sort({ createdAt: 1 })
            .select('-__v -contextReferences')
            .lean();
            
            const exportData = {
                session: {
                    id: session._id,
                    title: session.title,
                    model: session.modelUsed,
                    createdAt: session.createdAt,
                    messageCount: session.messageCount
                },
                messages,
                exportDate: new Date(),
                totalMessages: messages.length
            };
            
            if (format === 'txt') {
                // Format as plain text
                let textContent = `Chat Session: ${session.title}\n`;
                textContent += `Model: ${session.modelUsed}\n`;
                textContent += `Created: ${session.createdAt}\n`;
                textContent += `Total Messages: ${messages.length}\n\n`;
                textContent += '='.repeat(50) + '\n\n';
                
                messages.forEach((msg, index) => {
                    textContent += `${msg.role.toUpperCase()} (${new Date(msg.createdAt).toLocaleString()}):\n`;
                    textContent += msg.content + '\n\n';
                    textContent += '-'.repeat(30) + '\n\n';
                });
                
                res.setHeader('Content-Type', 'text/plain');
                res.setHeader('Content-Disposition', `attachment; filename="chat-${sessionId}.txt"`);
                return res.send(textContent);
            }
            
            // Default: JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="chat-${sessionId}.json"`);
            return res.send(JSON.stringify(exportData, null, 2));
            
        } catch (error) {
            logger.error('Export chat history error:', error);
            return responseHandler.serverError(res, 'Failed to export chat history');
        }
    }

    // Get recent chats across all sessions
    async getRecentChats(req, res) {
        try {
            const { limit = 10 } = req.query;
            
            const recentMessages = await ChatHistory.find({
                user: req.user._id,
                role: { $in: ['user', 'assistant'] }
            })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('session', 'title modelUsed')
            .select('role content createdAt session')
            .lean();
            
            return responseHandler.success(res, 'Recent chats retrieved', {
                messages: recentMessages
            });
            
        } catch (error) {
            logger.error('Get recent chats error:', error);
            return responseHandler.serverError(res, 'Failed to retrieve recent chats');
        }
    }
}

const historyController = new HistoryController();
export default historyController;