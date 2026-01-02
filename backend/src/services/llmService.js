import aiConfig from '../config/ai.js';
import logger from '../utils/logger.js';

class LLMService {
    constructor() {
        this.googleAI = aiConfig.getGoogleAI();
        this.settings = aiConfig.getSettings();
        this.model = aiConfig.getChatModel();
        this.generationConfig = aiConfig.getGenerationConfig();
        this.safetySettings = aiConfig.getSafetySettings();
    }

    async generateResponse(messages, context = '', options = {}) {
        try {
            const {
                model = this.model,
                temperature = this.settings.temperature,
                maxTokens = this.settings.maxTokens,
                stream = false
            } = options;

            // Prepare prompt with context
            let prompt = '';
            
            if (context) {
                prompt = `Context information:\n${context}\n\n`;
                prompt += `Based on the above context, answer the following conversation. If the context doesn't contain relevant information, use your general knowledge but be honest about the limitations.\n\n`;
            }

            // Convert messages to Gemini format
            const history = this.convertToGeminiFormat(messages);
            prompt += this.formatMessagesForPrompt(history);

            if (stream) {
                return this.generateStreamingResponse(prompt, { model, temperature, maxTokens });
            }

            // Generate response using Gemini
            const geminiModel = this.googleAI.getGenerativeModel({ 
                model,
                safetySettings: this.safetySettings,
                generationConfig: {
                    ...this.generationConfig,
                    temperature,
                    maxOutputTokens: maxTokens
                }
            });

            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const content = response.text();
            
            // Estimate tokens (Gemini doesn't return token count in free tier)
            const tokens = this.estimateTokens(prompt + content);

            logger.info(`Gemini response generated: ${tokens} estimated tokens`);
            return { content, tokens };
            
        } catch (error) {
            logger.error('Gemini generation error:', error);
            
            // Check for specific errors
            if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                throw new Error('API quota exceeded. Please try again later or check your Google Cloud billing.');
            }
            
            if (error.message?.includes('safety')) {
                throw new Error('Response blocked by safety filters. Please rephrase your question.');
            }
            
            throw new Error(`Failed to generate response: ${error.message}`);
        }
    }

    async generateStreamingResponse(prompt, options) {
        try {
            const { model, temperature, maxTokens } = options;
            
            const geminiModel = this.googleAI.getGenerativeModel({ 
                model,
                safetySettings: this.safetySettings,
                generationConfig: {
                    ...this.generationConfig,
                    temperature,
                    maxOutputTokens: maxTokens
                }
            });

            // Note: Gemini free tier has limited streaming support
            // We'll simulate streaming by splitting the response
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const content = response.text();
            
            // Simulate streaming by splitting into chunks
            const chunks = content.match(/.{1,50}/g) || [content];
            
            // Return an async generator
            return (async function* () {
                for (const chunk of chunks) {
                    yield {
                        choices: [{
                            delta: { content: chunk }
                        }]
                    };
                    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
                }
            })();
            
        } catch (error) {
            logger.error('Streaming Gemini error:', error);
            throw error;
        }
    }

    // Convert standard chat format to Gemini format
    convertToGeminiFormat(messages) {
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
    }

    // Format messages for Gemini prompt
    formatMessagesForPrompt(messages) {
        let prompt = '';
        messages.forEach(msg => {
            if (msg.role === 'user') {
                prompt += `User: ${msg.parts[0].text}\n`;
            } else if (msg.role === 'model') {
                prompt += `Assistant: ${msg.parts[0].text}\n`;
            } else if (msg.role === 'system') {
                prompt += `System: ${msg.parts[0].text}\n`;
            }
        });
        return prompt;
    }

    // Simple token estimation
    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for English text
        return Math.ceil(text.length / 4);
    }

    async countTokens(text) {
        return this.estimateTokens(text);
    }

    async validateContextSize(context, maxTokens = 30000) {
        // Gemini has ~30K token context window
        const tokenCount = await this.countTokens(context);
        return tokenCount <= maxTokens;
    }

    // Vision support (optional)
    async generateWithVision(prompt, imageBuffer, mimeType) {
        try {
            const model = this.googleAI.getGenerativeModel({ 
                model: 'gemini-pro-vision',
                safetySettings: this.safetySettings,
                generationConfig: this.generationConfig
            });

            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType: mimeType
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            return { content: text, provider: 'gemini-vision' };
            
        } catch (error) {
            logger.error('Gemini vision generation error:', error);
            throw error;
        }
    }

    // Function calling support (for advanced features)
    async generateWithTools(prompt, tools = []) {
        try {
            // Note: Function calling requires Gemini 1.5 Pro or higher
            // This is a simplified implementation
            
            const model = this.googleAI.getGenerativeModel({ 
                model: 'gemini-1.5-pro-latest',
                safetySettings: this.safetySettings,
                generationConfig: this.generationConfig,
                tools: tools.length > 0 ? tools : undefined
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            // Check for function calls in response
            const functionCalls = response.functionCalls();
            const text = response.text();

            return { 
                content: text, 
                functionCalls,
                provider: 'gemini-pro' 
            };
            
        } catch (error) {
            logger.error('Gemini tools generation error:', error);
            // Fallback to regular generation
            return this.generateResponse([{ role: 'user', content: prompt }]);
        }
    }
}

const llmService = new LLMService();
export default llmService;