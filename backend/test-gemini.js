import dotenv from 'dotenv';
dotenv.config();

import Cohere from 'cohere-ai';

async function testCohere() {
    try {
        if (!process.env.COHERE_API_KEY) {
            console.error('❌ COHERE_API_KEY not set in .env');
            console.log('💡 Get a free key from: https://dashboard.cohere.com/api-keys');
            process.exit(1);
        }

        console.log('🔧 Testing Cohere API...\n');
        
        // Initialize Cohere client
        const cohere = new Cohere.CohereClient({
            token: process.env.COHERE_API_KEY,
        });

        // Test 1: Generate text
        console.log('🧪 Test 1: Text Generation');
        try {
            const response = await cohere.generate({
                prompt: 'Hello! Say something short.',
                model: 'command',
                maxTokens: 50,
                temperature: 0.7
            });
            
            console.log('✅ Generation successful');
            console.log(`📝 Response: ${response.generations[0].text}`);
        } catch (error) {
            console.log('❌ Generation failed:', error.message);
        }

        // Test 2: Chat
        console.log('\n🧪 Test 2: Chat');
        try {
            const response = await cohere.chat({
                message: 'What is artificial intelligence?',
                model: 'command-r-plus',
                temperature: 0.7
            });
            
            console.log('✅ Chat successful');
            console.log(`📝 Response: ${response.text.substring(0, 100)}...`);
        } catch (error) {
            console.log('❌ Chat failed:', error.message);
            
            // Try with lighter model
            try {
                const response = await cohere.chat({
                    message: 'Hello',
                    model: 'command',
                    temperature: 0.7
                });
                console.log('✅ Chat with command model works');
            } catch (error2) {
                console.log('❌ All chat models failed');
            }
        }

        // Test 3: Embeddings
        console.log('\n🧪 Test 3: Embeddings');
        try {
            const response = await cohere.embed({
                texts: ['This is a test sentence.'],
                model: 'embed-english-v3.0'
            });
            
            console.log('✅ Embeddings successful');
            console.log(`📏 Dimensions: ${response.embeddings[0].length}`);
            console.log(`📊 Shape: ${response.embeddings.length} x ${response.embeddings[0].length}`);
        } catch (error) {
            console.log('❌ Embeddings failed:', error.message);
        }

        // Test 4: Rerank
        console.log('\n🧪 Test 4: Reranking');
        try {
            const response = await cohere.rerank({
                query: 'What is machine learning?',
                documents: [
                    'Machine learning is a subset of AI.',
                    'Deep learning uses neural networks.',
                    'Python is a programming language.'
                ],
                model: 'rerank-english-v3.0',
                topN: 2
            });
            
            console.log('✅ Reranking successful');
            console.log(`📊 Results: ${response.results.length}`);
        } catch (error) {
            console.log('❌ Reranking failed:', error.message);
        }

        console.log('\n🎯 Cohere API Test Summary:');
        console.log('✅ Free tier includes:');
        console.log('   - 100+ free API calls per minute');
        console.log('   - Command and Command-Light models');
        console.log('   - Embedding models');
        console.log('   - Reranking (limited)');
        console.log('\n💡 For production:');
        console.log('   - Upgrade for higher limits');
        console.log('   - Use command-r-plus for better results');
        console.log('   - Enable web search for latest information');

    } catch (error) {
        console.error('\n❌ Cohere API test failed:', error.message);
        
        if (error.status === 401) {
            console.log('\n🔑 Authentication failed:');
            console.log('1. Check your COHERE_API_KEY in .env');
            console.log('2. Get a new key from: https://dashboard.cohere.com/api-keys');
            console.log('3. Make sure the key is active');
        } else if (error.status === 429) {
            console.log('\n⚠️ Rate limited:');
            console.log('1. Free tier has limits');
            console.log('2. Wait a minute and try again');
            console.log('3. Consider upgrading for higher limits');
        } else if (error.status === 403) {
            console.log('\n💰 Quota exceeded:');
            console.log('1. Check your usage at: https://dashboard.cohere.com/usage');
            console.log('2. Free tier has monthly limits');
            console.log('3. Upgrade for more capacity');
        }
        
        console.log('\n📚 Resources:');
        console.log('- Cohere Dashboard: https://dashboard.cohere.com');
        console.log('- API Documentation: https://docs.cohere.com');
        console.log('- Free Tier Limits: https://docs.cohere.com/docs/free-trial');
    }
}

testCohere();