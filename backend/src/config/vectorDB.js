import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
dotenv.config();

class PineconeClient {
    constructor() {
        this.client = null;
        this.index = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            if(!process.env.PINECONE_API_KEY) {
                throw new Error('Pinecone API key is missing');
            }
            this.client = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });
            const indexName = process.env.PINECONE_INDEX_NAME || 'default-index';
            const indexes = await this.client.listIndexes();
            const indexExists = indexes.indexes?.some(idx => idx === indexName);

            if(!indexExists) {
                await this.client.createIndex({
                    name: indexName,
                    dimension: parseInt(process.env.EMBEDDING_DIMENSION) || 1536,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: process.env.PINECONE_ENVIRONMENT || 'us-east-1'
                        }
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
            this.index = this.client.Index(indexName);
            this.initialized = true;

            logger.info('Pinecone client initialized successfully');
            return this.index;
        } catch (error) {
            logger.error('Error initializing Pinecone client', error);
            throw error;
        }
    }

    async getIndex() {
        if(!this.initialized) {
            await this.initialize();
        }
        return this.index;
    }

    async testConnection() {
        try {
            const index = await this.getIndex();
            const stats = await index.describeIndexStats();
            return {
                success: true,
                stats,
                message: 'Pinecone connection successful'
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Pinecone connection failed'
            };
        }
    }
}

const pineconeClinetInstance = new PineconeClient();
export default pineconeClinetInstance;