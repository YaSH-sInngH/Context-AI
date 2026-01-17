import dotenv from 'dotenv';
dotenv.config();

import Cohere from 'cohere-ai';

async function testCohere() {
  try {
    console.log('🔧 Testing Cohere API...\n');

    const cohere = new Cohere.CohereClient({
      token: process.env.COHERE_API_KEY,
    });

    // ✅ Chat (ONLY supported way now)
    console.log('🧪 Test 1: Chat');
    const chatRes = await cohere.chat({
      model: 'command-nightly',
      message: 'Hello! Say something short.',
      temperature: 0.7,
    });

    console.log('✅ Chat successful');
    console.log('📝 Response:', chatRes.text);

    // ✅ Embeddings
    console.log('\n🧪 Test 2: Embeddings');
    const embedRes = await cohere.embed({
      model: 'embed-english-v3.0',
      texts: ['This is a test sentence.'],
      input_type: 'search_document',
    });

    console.log('✅ Embeddings successful');
    console.log('📏 Dimensions:', embedRes.embeddings[0].length);

    // ✅ Rerank
    console.log('\n🧪 Test 3: Reranking');
    const rerankRes = await cohere.rerank({
      model: 'rerank-english-v3.0',
      query: 'What is machine learning?',
      documents: [
        'Machine learning is a subset of AI.',
        'Deep learning uses neural networks.',
        'Python is a programming language.',
      ],
      topN: 2,
    });

    console.log('✅ Reranking successful');
    console.log('📊 Results:', rerankRes.results.length);

    console.log('\n🎯 All Cohere tests passed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testCohere();
