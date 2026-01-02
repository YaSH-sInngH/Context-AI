import pineconeClient from '../config/vectorDB.js';
import VectorStore from '../models/VectorStore.js';
import embeddingService from './embeddingService.js';
import logger from '../utils/logger.js';

class VectorService {
    constructor() {
        this.namespace = process.env.PINECONE_NAMESPACE || 'chat-ai';
        this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7;
        this.maxResults = parseInt(process.env.MAX_CONTEXT_CHUNKS) || 5;
    }

    async initialize() {
        try {
            this.index = await pineconeClient.getIndex();
            logger.info('Vector service initialized');
        } catch (error) {
            logger.error('Vector service initialization error:', error);
            throw error;
        }
    }

    async getIndex() {
        if (!this.index) {
            await this.initialize();
        }
        return this.index;
    }

    async storeEmbedding(content, metadata = {}) {
        try {
            const embedding = await embeddingService.generateEmbedding(content);
            
            // Generate unique ID
            const embeddingId = `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store in Pinecone
            const index = await this.getIndex();
            await index.namespace(this.namespace).upsert([{
                id: embeddingId,
                values: embedding,
                metadata: {
                    content: content.substring(0, 1000), // Store truncated content
                    ...metadata
                }
            }]);

            // Store reference in MongoDB
            const vectorDoc = new VectorStore({
                sourceType: metadata.sourceType || 'manual',
                sourceId: metadata.sourceId || embeddingId,
                content,
                metadata,
                embeddingId,
                embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002'
            });

            await vectorDoc.save();
            
            logger.info(`Embedding stored: ${embeddingId}`);
            return { embeddingId, success: true };
            
        } catch (error) {
            logger.error('Store embedding error:', error);
            throw error;
        }
    }

    async searchSimilar(query, options = {}) {
        try {
            const {
                topK = this.maxResults,
                filter = {},
                includeMetadata = true
            } = options;

            // Generate query embedding
            const queryEmbedding = await embeddingService.generateEmbedding(query);
            
            // Search in Pinecone
            const index = await this.getIndex();
            const searchResponse = await index.namespace(this.namespace).query({
                vector: queryEmbedding,
                topK,
                filter,
                includeMetadata,
                includeValues: false
            });

            // Filter by similarity threshold and format results
            const results = searchResponse.matches
                .filter(match => match.score >= this.similarityThreshold)
                .map(match => ({
                    id: match.id,
                    score: match.score,
                    content: match.metadata?.content || '',
                    metadata: match.metadata || {}
                }));

            // Update access count for retrieved vectors
            await this.updateAccessCount(results.map(r => r.id));

            logger.info(`Search completed: ${results.length} results found`);
            return results;
            
        } catch (error) {
            logger.error('Vector search error:', error);
            throw error;
        }
    }

    async updateAccessCount(vectorIds) {
        try {
            await VectorStore.updateMany(
                { embeddingId: { $in: vectorIds } },
                { 
                    $inc: { accessCount: 1 },
                    $set: { lastAccessed: new Date() }
                }
            );
        } catch (error) {
            logger.error('Update access count error:', error);
        }
    }

    async deleteEmbedding(embeddingId) {
        try {
            const index = await this.getIndex();
            
            // Delete from Pinecone
            await index.namespace(this.namespace).deleteOne(embeddingId);
            
            // Delete from MongoDB
            await VectorStore.deleteOne({ embeddingId });
            
            logger.info(`Embedding deleted: ${embeddingId}`);
            return { success: true };
            
        } catch (error) {
            logger.error('Delete embedding error:', error);
            throw error;
        }
    }

    async getVectorStats() {
        try {
            const index = await this.getIndex();
            const stats = await index.describeIndexStats();
            
            const vectorCount = await VectorStore.countDocuments();
            
            return {
                pineconeStats: stats,
                mongoStats: {
                    totalVectors: vectorCount,
                    mostAccessed: await VectorStore.find().sort({ accessCount: -1 }).limit(5)
                }
            };
            
        } catch (error) {
            logger.error('Get vector stats error:', error);
            throw error;
        }
    }
}

const vectorService = new VectorService();
export default vectorService;