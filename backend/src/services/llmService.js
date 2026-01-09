import aiConfig from '../config/ai.js';
import logger from '../utils/logger.js';

class LLMService {
    constructor() {
        this.cohere = aiConfig.getCohere();
        this.settings = aiConfig.getSettings();
        this.model = aiConfig.getChatModel();
        this.availableModels = aiConfig.getAvailableModels().chat;
    }

    async generateResponse(messages, context = '', options = {}) {
        try {
            const {
                model = this.model,
                temperature = this.settings.temperature,
                maxTokens = this.settings.maxTokens,
                stream = false
            } = options;

            // Convert messages to Cohere format
            const chatHistory = this.convertToCohereFormat(messages);
            
            // Prepare the prompt with context
            let prompt = '';
            if (context) {
                prompt = `Context information:\n${context}\n\n`;
                prompt += `Based strictly on the above context, answer the user's question. `;
                prompt += `If the context doesn't contain the answer, say "I don't have enough information from the provided context."\n\n`;
            }

            // Get the last user message
            const lastUserMessage = messages.filter(m => m.role === 'user').pop();
            if (!lastUserMessage) {
                throw new Error('No user message found');
            }

            prompt += lastUserMessage.content;

            if (stream) {
                return this.generateStreamingResponse(prompt, chatHistory, { model, temperature, maxTokens });
            }

            // Generate response using Cohere
            const response = await this.cohere.chat({
                model: model,
                message: prompt,
                chatHistory: chatHistory,
                temperature: temperature,
                maxTokens: maxTokens,
                p: this.settings.topP,
                frequencyPenalty: this.settings.frequencyPenalty,
                presencePenalty: this.settings.presencePenalty,
                connectors: [{ id: "web-search" }] // Optional: enable web search
            });

            const content = response.text;
            const tokens = this.estimateTokens(content);

            logger.info(`Cohere response generated: ${tokens} estimated tokens`);
            return { content, tokens };
            
        } catch (error) {
            logger.error('Cohere generation error:', error);
            
            // Handle specific errors
            if (error.status === 429) {
                throw new Error('Rate limit exceeded. Please try again in a moment.');
            }
            
            if (error.status === 403) {
                throw new Error('API quota exceeded. Please check your Cohere account.');
            }
            
            if (error.status === 400 && error.message?.includes('model')) {
                throw new Error(`Model not available. Try using 'command' or 'command-light' instead.`);
            }
            
            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }

    async generateStreamingResponse(prompt, chatHistory, options) {
        try {
            const { model, temperature, maxTokens } = options;
            
            const stream = await this.cohere.chatStream({
                model: model,
                message: prompt,
                chatHistory: chatHistory,
                temperature: temperature,
                maxTokens: maxTokens,
                p: this.settings.topP
            });

            // Return an async generator for the stream
            return (async function* () {
                for await (const message of stream) {
                    if (message.eventType === 'text-generation') {
                        yield {
                            choices: [{
                                delta: { content: message.text }
                            }]
                        };
                    }
                }
            })();
            
        } catch (error) {
            logger.error('Cohere streaming error:', error);
            throw error;
        }
    }

    // Convert standard chat format to Cohere format
    convertToCohereFormat(messages) {
        const cohereMessages = [];
        
        for (const msg of messages) {
            if (msg.role === 'system') {
                // Cohere doesn't have system messages, prepend to first user message
                if (cohereMessages.length === 0) {
                    cohereMessages.push({
                        role: 'USER',
                        message: `System: ${msg.content}`
                    });
                }
            } else if (msg.role === 'user') {
                cohereMessages.push({
                    role: 'USER',
                    message: msg.content
                });
            } else if (msg.role === 'assistant') {
                cohereMessages.push({
                    role: 'CHATBOT',
                    message: msg.content
                });
            }
        }
        
        return cohereMessages;
    }

    // Rerank search results (improves RAG quality)
    async rerankDocuments(query, documents, options = {}) {
        try {
            const {
                model = aiConfig.getRerankModel(),
                topN = 10,
                returnDocuments = true
            } = options;

            if (!documents || documents.length === 0) {
                return [];
            }

            const response = await this.cohere.rerank({
                model: model,
                query: query,
                documents: documents,
                topN: topN,
                returnDocuments: returnDocuments
            });

            return response.results;
            
        } catch (error) {
            logger.error('Cohere rerank error:', error);
            // Return original documents if reranking fails
            return documents.map((doc, index) => ({
                index: index,
                relevanceScore: 0.5
            }));
        }
    }

    // Classify text (useful for moderation or routing)
    async classifyText(text, options = {}) {
        try {
            const {
                model = 'embed-english-v2.0', // Cohere's classification endpoint
                inputs = [text]
            } = options;

            const response = await this.cohere.classify({
                model: model,
                inputs: inputs,
                examples: options.examples || []
            });

            return response.classifications;
            
        } catch (error) {
            logger.error('Cohere classify error:', error);
            return [];
        }
    }

    // Summarize text
    async summarizeText(text, options = {}) {
        try {
            const {
                model = this.model,
                length = 'auto',
                format = 'auto',
                extractiveness = 'auto'
            } = options;

            const response = await this.cohere.summarize({
                text: text,
                model: model,
                length: length,
                format: format,
                extractiveness: extractiveness,
                temperature: this.settings.temperature
            });

            return response.summary;
            
        } catch (error) {
            logger.error('Cohere summarize error:', error);
            return text.substring(0, 200) + '...'; // Simple truncation fallback
        }
    }

    // Token estimation
    estimateTokens(text) {
        // Cohere tokens ≈ 4 characters for English
        return Math.ceil(text.length / 4);
    }

    async countTokens(text) {
        return this.estimateTokens(text);
    }

    async validateContextSize(context, maxTokens = 4000) {
        const tokenCount = await this.countTokens(context);
        return tokenCount <= maxTokens;
    }

    // Get model information
    getModelInfo(modelName = null) {
        const model = modelName || this.model;
        return this.availableModels[model] || null;
    }
}

const llmService = new LLMService();
export default llmService;