import ChatSession from '../models/ChatSession.js';
import ChatHistory from '../models/ChatHistory.js';
import ragService from '../services/ragService.js';
import vectorService from '../services/vectorService.js';
import {responseHandler} from '../utils/responseHandler.js';
import logger from '../utils/logger.js';

class ChatController {
    async createSession(req, res) {
        try {
            const {title, model='gemini-pro', settings} = req.body;
            const session = new ChatSession({
                user: req.user._id,
                title: title || 'New Chat',
                modelUsed: model,
                settings: settings || {
                    temperature: 0.7,
                    maxTokens: 1000
                }
            });
            await session.save();
            
            logger.info(`Chat session created: ${session._id} for user ${req.user._id}`);
            
            return responseHandler.created(res, 'Chat session created', {
                session: {
                    id: session._id,
                    title: session.title,
                    model: session.modelUsed,
                    createdAt: session.createdAt
                }
            });
        } catch (error) {
            logger.error('Create session error:', error);
            return responseHandler.serverError(res, 'Failed to create chat session');
        }
    }

    async sendMessage(req, res){
        try {
            const {sessionId, message, useRAG=true, stream=false} = req.body;
            const session = await ChatSession.findOne({
                _id: sessionId,
                user: req.user._id,
                isActive: true,
            });
            if(!session){
                return responseHandler.notFound(res, 'Chat session not found or inactive');
            }
            const userMessage = new ChatHistory({
                session: sessionId,
                user: req.user._id,
                role: 'user',
                content: message,
                model: session.modelUsed
            });
            await userMessage.save();
            const chatHistory = await ChatHistory.find({
                session: sessionId,
                role: { $in: ['user', 'assistant'] }
            }).sort({ createdAt: 1 }).limit(20);
            const response = await ragService.generateAnswer(message, chatHistory, {
                useRAG,
                stream,
                model: session.modelUsed,
                temperature: session.settings.temperature
            });
            const assistantMessage = new ChatHistory({
                session: sessionId,
                user: req.user._id,
                role: 'assistant',
                content: response.answer,
                model: session.modelUsed,
                contextReferences: response.contextReferences,
                tokens: response.tokens
            });
            await assistantMessage.save();
            session.messageCount += 2;
            session.tokenCount += response.tokens;
            session.lastMessageAt = new Date();
            await session.save();
            
            if (stream && response.answer && response.answer[Symbol.asyncIterator]) {
                // Handle streaming response
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
                
                for await (const chunk of response.answer) {
                    if (chunk.choices[0]?.delta?.content) {
                        res.write(`data: ${JSON.stringify({
                            content: chunk.choices[0].delta.content,
                            done: false
                        })}\n\n`);
                    }
                }
                
                res.write(`data: ${JSON.stringify({
                    messageId: assistantMessage._id,
                    contextReferences: response.contextReferences,
                    done: true
                })}\n\n`);
                
                res.end();
                return;
            }
            
            logger.info(`Message sent in session ${sessionId}: ${message.substring(0, 50)}...`);
            
            return responseHandler.success(res, 'Message sent', {
                messageId: assistantMessage._id,
                content: response.answer,
                contextReferences: response.contextReferences,
                session: {
                    id: session._id,
                    messageCount: session.messageCount,
                    tokenCount: session.tokenCount
                }
            });
        } catch (error) {
            logger.error('Send message error:', error);
            return responseHandler.serverError(res, 'Failed to send message');
        }
    }

    async uploadDocument(req, res) {
        try {
            const { content, metadata = {}, sourceType = 'document' } = req.body;
            
            if (!content || typeof content !== 'string') {
                return responseHandler.badRequest(res, 'Document content is required');
            }
            
            const result = await ragService.processDocument(content, {
                ...metadata,
                sourceType,
                uploadedBy: req.user._id,
                uploadedAt: new Date()
            });
            
            logger.info(`Document uploaded by user ${req.user._id}: ${result.totalChunks} chunks`);
            
            return responseHandler.success(res, 'Document uploaded successfully', result);
            
        } catch (error) {
            logger.error('Upload document error:', error);
            return responseHandler.serverError(res, 'Failed to upload document');
        }
    }

    async searchKnowledge(req, res) {
        try {
            const { query, topK = 5, filter = {} } = req.body;
            
            if (!query || typeof query !== 'string') {
                return responseHandler.badRequest(res, 'Search query is required');
            }
            
            const results = await vectorService.searchSimilar(query, {
                topK,
                filter
            });
            
            return responseHandler.success(res, 'Search completed', {
                query,
                results,
                count: results.length
            });
            
        } catch (error) {
            logger.error('Search knowledge error:', error);
            return responseHandler.serverError(res, 'Failed to search knowledge base');
        }
    }

    async getSessions(req, res) {
        try {
            const { page = 1, limit = 20, activeOnly = true } = req.query;
            
            const query = { user: req.user._id };
            if (activeOnly) {
                query.isActive = true;
            }
            
            const sessions = await ChatSession.find(query)
                .sort({ lastMessageAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .select('-__v');
            
            const total = await ChatSession.countDocuments(query);
            
            return responseHandler.success(res, 'Sessions retrieved', {
                sessions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
            
        } catch (error) {
            logger.error('Get sessions error:', error);
            return responseHandler.serverError(res, 'Failed to retrieve sessions');
        }
    }

    async deleteSession(req, res) {
        try {
            const { sessionId } = req.params;
            
            const session = await ChatSession.findOneAndUpdate(
                {
                    _id: sessionId,
                    user: req.user._id
                },
                { isActive: false },
                { new: true }
            );
            
            if (!session) {
                return responseHandler.notFound(res, 'Chat session not found');
            }
            
            logger.info(`Chat session deactivated: ${sessionId} by user ${req.user._id}`);
            
            return responseHandler.success(res, 'Chat session deleted', {
                sessionId: session._id,
                isActive: session.isActive
            });
            
        } catch (error) {
            logger.error('Delete session error:', error);
            return responseHandler.serverError(res, 'Failed to delete session');
        }
    }

    async getVectorStats(req, res) {
        try {
            const stats = await vectorService.getVectorStats();
            
            return responseHandler.success(res, 'Vector stats retrieved', stats);
            
        } catch (error) {
            logger.error('Get vector stats error:', error);
            return responseHandler.serverError(res, 'Failed to get vector stats');
        }
    }
}

const chatController = new ChatController();
export default chatController;