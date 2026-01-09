import aiConfig from '../config/ai.js';
import logger from '../utils/logger.js';

class EmbeddingService {
    constructor() {
        this.cohere = aiConfig.getCohere();
        this.model = aiConfig.getEmbedModel();
        this.dimensions = aiConfig.getEmbeddingDimensions();
    }

    async generateEmbedding(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text input for embedding');
            }

            // Truncate very long texts (Cohere has limits)
            const truncatedText = text.length > 2048 ? text.substring(0, 2048) : text;
            
            const response = await this.cohere.embed({
                texts: [truncatedText],
                model: this.model,
                inputType: 'search_document' // or 'search_query', 'classification', 'clustering'
            });
            
            if (!response.embeddings || response.embeddings.length === 0) {
                throw new Error('Failed to generate embedding: Empty response');
            }
            
            const embedding = response.embeddings[0];
            
            logger.debug(`Embedding generated for text: ${truncatedText.substring(0, 50)}...`);
            return embedding;
            
        } catch (error) {
            logger.error('Cohere embedding generation error:', error);
            
            // Check for rate limits
            if (error.status === 429 || error.message?.includes('rate limit')) {
                logger.warn('Cohere rate limit reached, using fallback embedding');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                return this.generateFallbackEmbedding(text);
            }
            
            // Check for quota issues
            if (error.status === 403 || error.message?.includes('quota')) {
                logger.warn('Cohere quota exceeded, using fallback embedding');
                return this.generateFallbackEmbedding(text);
            }
            
            throw new Error(`Failed to generate embedding: ${error.message}`);
        }
    }

    async generateBatchEmbeddings(texts, options = {}) {
        try {
            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch embedding');
            }

            // Truncate texts and prepare batch
            const truncatedTexts = texts.map(text => 
                text.length > 2048 ? text.substring(0, 2048) : text
            );

            const response = await this.cohere.embed({
                texts: truncatedTexts,
                model: this.model,
                inputType: options.inputType || 'search_document',
                truncate: 'END' // or 'START', 'NONE'
            });
            
            if (!response.embeddings || response.embeddings.length !== texts.length) {
                throw new Error('Batch embedding response mismatch');
            }
            
            logger.info(`Batch embeddings generated: ${response.embeddings.length} texts`);
            return response.embeddings;
            
        } catch (error) {
            logger.error('Cohere batch embedding error:', error);
            
            // Fallback to individual embeddings with delay
            if (error.status === 429) {
                logger.warn('Rate limited, processing individually with delays');
                const embeddings = [];
                for (const text of texts) {
                    try {
                        const embedding = await this.generateEmbedding(text);
                        embeddings.push(embedding);
                        await new Promise(resolve => setTimeout(resolve, 200)); // Delay between requests
                    } catch (err) {
                        logger.error(`Failed embedding for text: ${err.message}`);
                        embeddings.push(this.generateFallbackEmbedding(text));
                    }
                }
                return embeddings;
            }
            
            // Ultimate fallback
            logger.warn('Using fallback batch embedding');
            return texts.map(text => this.generateFallbackEmbedding(text));
        }
    }

    // Generate embeddings optimized for search queries
    async generateQueryEmbedding(query) {
        try {
            const response = await this.cohere.embed({
                texts: [query],
                model: this.model,
                inputType: 'search_query'
            });
            
            return response.embeddings[0];
        } catch (error) {
            logger.error('Query embedding error:', error);
            return this.generateFallbackEmbedding(query);
        }
    }

    // Simple fallback embedding (deterministic)
    generateFallbackEmbedding(text) {
        try {
            const dimensions = this.dimensions;
            const embedding = new Array(dimensions).fill(0);
            
            // Simple hash-based deterministic embedding
            const words = text.toLowerCase().split(/\s+/);
            words.forEach(word => {
                // Simple hash function
                let hash = 0;
                for (let i = 0; i < word.length; i++) {
                    hash = ((hash << 5) - hash) + word.charCodeAt(i);
                    hash = hash & hash;
                }
                
                // Distribute across dimensions
                const baseIndex = Math.abs(hash) % dimensions;
                embedding[baseIndex] = (embedding[baseIndex] + 0.1) % 1.0;
                
                // Distribute to neighboring dimensions
                for (let j = 1; j <= 3; j++) {
                    const idx = (baseIndex + j) % dimensions;
                    embedding[idx] = (embedding[idx] + 0.05) % 0.5;
                }
            });
            
            // Normalize
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                return embedding.map(val => val / magnitude);
            }
            
            return embedding;
            
        } catch (error) {
            logger.error('Fallback embedding error:', error);
            return new Array(this.dimensions).fill(0);
        }
    }

    // Calculate cosine similarity
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            logger.error(`Vector dimension mismatch: ${vecA?.length} vs ${vecB?.length}`);
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        const similarity = dotProduct / (normA * normB);
        return Math.max(0, Math.min(1, similarity)); // Clamp between 0 and 1
    }

    validateEmbedding(embedding) {
        return Array.isArray(embedding) && 
               embedding.length === this.dimensions && 
               embedding.every(val => typeof val === 'number');
    }
}

const embeddingService = new EmbeddingService();
export default embeddingService;