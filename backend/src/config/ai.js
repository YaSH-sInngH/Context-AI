import dotenv from 'dotenv';
import Cohere from 'cohere-ai';

dotenv.config();

class AIConfig {
    constructor() {
        this.cohere = null;
        this.availableModels = {
            chat: {
                'command': {
                    name: 'command',
                    description: 'Most capable model, good for complex tasks',
                    contextLength: 4096,
                    isLatest: false
                },
                'command-light': {
                    name: 'command-light',
                    description: 'Fast and efficient for simple tasks',
                    contextLength: 4096,
                    isLatest: false
                },
                'command-r': {
                    name: 'command-r',
                    description: 'Balanced model with 128K context',
                    contextLength: 128000,
                    isLatest: true
                },
                'command-r-plus': {
                    name: 'command-r-plus',
                    description: 'Most capable with 128K context',
                    contextLength: 128000,
                    isLatest: true
                }
            },
            embed: {
                'embed-english-v3.0': {
                    name: 'embed-english-v3.0',
                    description: 'English embeddings (1024 dimensions)',
                    dimensions: 1024,
                    isLatest: true
                },
                'embed-multilingual-v3.0': {
                    name: 'embed-multilingual-v3.0',
                    description: 'Multilingual embeddings (1024 dimensions)',
                    dimensions: 1024,
                    isLatest: true
                },
                'embed-english-light-v3.0': {
                    name: 'embed-english-light-v3.0',
                    description: 'Lightweight English embeddings',
                    dimensions: 384,
                    isLatest: true
                }
            },
            rerank: {
                'rerank-english-v3.0': {
                    name: 'rerank-english-v3.0',
                    description: 'English reranking model'
                },
                'rerank-multilingual-v3.0': {
                    name: 'rerank-multilingual-v3.0',
                    description: 'Multilingual reranking model'
                }
            }
        };
        
        // Default selections
        this.models = {
            chat: process.env.COHERE_CHAT_MODEL || 'command-r-plus',
            embed: process.env.COHERE_EMBED_MODEL || 'embed-english-v3.0',
            rerank: process.env.COHERE_RERANK_MODEL || 'rerank-english-v3.0'
        };
        
        this.settings = {
            temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
            maxTokens: parseInt(process.env.MAX_TOKENS) || 1000,
            maxContextChunks: parseInt(process.env.MAX_CONTEXT_CHUNKS) || 5,
            similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7,
            topP: 0.75,
            frequencyPenalty: 0.1,
            presencePenalty: 0.1
        };
    }

    initializeCohere() {
        if (!process.env.COHERE_API_KEY) {
            throw new Error('COHERE_API_KEY is not configured');
        }
        
        console.log('🔧 Initializing Cohere with API key:', 
            process.env.COHERE_API_KEY.substring(0, 10) + '...');
        
        this.cohere = new Cohere.CohereClient({
            token: process.env.COHERE_API_KEY,
        });
        
        return this.cohere;
    }

    getCohere() {
        if (!this.cohere) {
            this.initializeCohere();
        }
        return this.cohere;
    }

    getChatModel(modelName = null) {
        const model = modelName || this.models.chat;
        return this.availableModels.chat[model]?.name || model;
    }

    getEmbedModel() {
        return this.models.embed;
    }

    getRerankModel() {
        return this.models.rerank;
    }

    getEmbeddingDimensions() {
        const model = this.availableModels.embed[this.models.embed];
        return model?.dimensions || 1024;
    }

    getSettings() {
        return this.settings;
    }

    getAvailableModels() {
        return this.availableModels;
    }
}

const aiConfig = new AIConfig();
export default aiConfig;