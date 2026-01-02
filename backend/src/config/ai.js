import dotenv from 'dotenv';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

dotenv.config();

class AIConfig {
    constructor() {
        this.googleAI = null;
        this.models = {
            chat: process.env.GOOGLE_CHAT_MODEL || 'gemini-pro',
            embedding: process.env.GOOGLE_EMBEDDING_MODEL || 'embedding-001',
            vision: 'gemini-pro-vision'  // Optional for image support
        };
        this.settings = {
            temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
            maxTokens: parseInt(process.env.MAX_TOKENS) || 1000,
            maxContextChunks: parseInt(process.env.MAX_CONTEXT_CHUNKS) || 5,
            similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7,
            safetySettings: this.getSafetySettings()
        };
    }

    initializeGoogleAI() {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
        }
        
        this.googleAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
        return this.googleAI;
    }

    getGoogleAI() {
        if (!this.googleAI) {
            this.initializeGoogleAI();
        }
        return this.googleAI;
    }

    getChatModel(modelName = null) {
        return modelName || this.models.chat;
    }

    getEmbeddingModel() {
        return this.models.embedding;
    }

    getSafetySettings() {
        return [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ];
    }

    getGenerationConfig() {
        return {
            temperature: this.settings.temperature,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: this.settings.maxTokens,
        };
    }

    getSettings() {
        return this.settings;
    }
}

const aiConfig = new AIConfig();
export default aiConfig;