import aiConfig from '../config/ai.js';
import logger from '../utils/logger.js';

class EmbeddingService {
    constructor() {
        this.googleAI = aiConfig.getGoogleAI();
        this.model = aiConfig.getEmbeddingModel();
    }

    async generateEmbedding(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text input for embedding');
            }

            // Google Gemini embedding generation
            const model = this.googleAI.getGenerativeModel({ 
                model: this.model 
            });

            const result = await model.embedContent(text);
            const embedding = result.embedding.values;
            
            if (!embedding || embedding.length === 0) {
                throw new Error('Failed to generate embedding: Empty response');
            }
            
            logger.debug(`Embedding generated for text: ${text.substring(0, 50)}...`);
            return embedding;
            
        } catch (error) {
            logger.error('Embedding generation error:', error);
            
            // Fallback to simple TF-IDF like embedding if Gemini fails
            if (error.message.includes('quota') || error.message.includes('rate limit')) {
                logger.warn('Using fallback embedding due to quota limits');
                return this.generateFallbackEmbedding(text);
            }
            
            throw new Error(`Failed to generate embedding: ${error.message}`);
        }
    }

    async generateBatchEmbeddings(texts) {
        try {
            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch embedding');
            }

            const model = this.googleAI.getGenerativeModel({ 
                model: this.model 
            });

            // Process in batches to avoid rate limits
            const batchSize = 5;
            const allEmbeddings = [];
            
            for (let i = 0; i < texts.length; i += batchSize) {
                const batch = texts.slice(i, i + batchSize);
                const batchPromises = batch.map(text => 
                    this.generateEmbedding(text).catch(err => {
                        logger.error(`Failed embedding for batch item: ${err.message}`);
                        return this.generateFallbackEmbedding(text);
                    })
                );
                
                const batchEmbeddings = await Promise.all(batchPromises);
                allEmbeddings.push(...batchEmbeddings);
                
                // Small delay between batches to avoid rate limits
                if (i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            logger.info(`Batch embeddings generated: ${allEmbeddings.length} texts`);
            return allEmbeddings;
            
        } catch (error) {
            logger.error('Batch embedding generation error:', error);
            
            // Fallback to individual embeddings
            logger.warn('Using fallback batch embedding');
            return Promise.all(
                texts.map(text => this.generateFallbackEmbedding(text))
            );
        }
    }

    // Simple fallback embedding (TF-IDF like) for when API fails
    generateFallbackEmbedding(text) {
        try {
            // Simple hash-based deterministic embedding (1536 dimensions like Ada-002)
            const dimensions = 1536;
            const embedding = new Array(dimensions).fill(0);
            
            // Simple tokenization and hash-based distribution
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
                embedding[baseIndex] = (embedding[baseIndex] + 1) % 1.0;
                
                // Distribute to neighboring dimensions
                const neighbors = 3;
                for (let j = 1; j <= neighbors; j++) {
                    const idx = (baseIndex + j) % dimensions;
                    embedding[idx] = (embedding[idx] + 1/(j+1)) % 1.0;
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
            // Return zero vector as last resort
            return new Array(1536).fill(0);
        }
    }

    // Calculate cosine similarity
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same dimensions and not be null');
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

        return dotProduct / (normA * normB);
    }

    // Utility function to validate embedding
    validateEmbedding(embedding) {
        return Array.isArray(embedding) && 
               embedding.length > 0 && 
               embedding.every(val => typeof val === 'number');
    }
}

const embeddingService = new EmbeddingService();
export default embeddingService;