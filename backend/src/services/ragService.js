import vectorService from './vectorService.js';
import llmService from './llmService.js';
import embeddingService from './embeddingService.js';
import logger from '../utils/logger.js';

class RAGService {
    constructor() {
        this.maxContextChunks = parseInt(process.env.MAX_CONTEXT_CHUNKS) || 5;
        this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7;
        // Gemini has larger context window
        this.maxContextTokens = 30000;
    }

    // ... [keep all existing methods, they work with Google embeddings] ...

    // Update validateContextSize to use Gemini's larger window
    async validateContextSize(context) {
        const tokenCount = await llmService.countTokens(context);
        const isValid = tokenCount <= this.maxContextTokens;
        
        if (!isValid) {
            logger.warn(`Context too large: ${tokenCount} tokens (max: ${this.maxContextTokens})`);
        }
        
        return isValid;
    }

    // Add method for Gemini-specific prompt formatting
    formatContextForGemini(contextResults) {
        if (!contextResults || contextResults.length === 0) {
            return '';
        }

        let formattedContext = "Relevant information from knowledge base:\n\n";
        
        contextResults.forEach((result, index) => {
            const relevance = result.score ? ` (Relevance: ${(result.score * 100).toFixed(1)}%)` : '';
            formattedContext += `[Source ${index + 1}${relevance}]:\n`;
            formattedContext += `${result.content}\n\n`;
        });

        formattedContext += "Based on this information, please answer the user's question accurately. ";
        formattedContext += "If the information doesn't fully answer the question, say so and provide general knowledge if helpful.";
        
        return formattedContext;
    }

    async generateAnswer(query, chatHistory = [], options = {}) {
        try {
            const {
                useRAG = true,
                stream = false,
                model = 'gemini-pro',
                temperature = 0.7
            } = options;

            let context = '';
            let contextReferences = [];

            if (useRAG) {
                // Retrieve relevant context
                const searchResults = await vectorService.searchSimilar(query, {
                    includeMetadata: true
                });

                if (searchResults.length > 0) {
                    context = this.formatContextForGemini(searchResults);
                    contextReferences = searchResults.map((result, index) => ({
                        sourceId: result.metadata.sourceId || result.id,
                        sourceType: result.metadata.sourceType || 'unknown',
                        chunkId: result.id,
                        similarityScore: result.score
                    }));
                }
            }

            // Prepare chat history
            const messages = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Add current query
            messages.push({ role: 'user', content: query });

            // Generate response with Gemini
            const response = await llmService.generateResponse(messages, context, {
                model,
                temperature,
                stream
            });
            return {
                answer: response.content || response,
                contextReferences,
                tokens: response.tokens || 0,
                hasContext: contextReferences.length > 0
            };
            
        } catch (error) {
            logger.error('RAG answer generation error:', error);
            throw error;
        }
    }
}

const ragService = new RAGService();
export default ragService;