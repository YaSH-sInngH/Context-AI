import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
    try {
        if (!process.env.GOOGLE_GEMINI_API_KEY) {
            console.error('❌ GOOGLE_GEMINI_API_KEY not set in .env');
            process.exit(1);
        }

        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        console.log('🧪 Testing Gemini API...');
        
        const prompt = 'Hello, who are you?';
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ Gemini API is working!');
        console.log('Response:', text)
        console.log('Response length:', text.length);
        
    } catch (error) {
        console.error('❌ Gemini API test failed:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('Please check your GOOGLE_GEMINI_API_KEY in .env');
            console.log('Get a key from: https://makersuite.google.com/app/apikey');
        } else if (error.message.includes('quota')) {
            console.log('API quota exceeded. Check Google Cloud Console billing.');
        } else if (error.message.includes('location')) {
            console.log('Gemini may not be available in your region yet.');
        }
        
        process.exit(1);
    }
}

testGemini();