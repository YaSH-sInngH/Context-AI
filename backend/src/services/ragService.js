import vectorService from './vectorService.js';
import llmService from './llmService.js';
import embeddingService from './embeddingService.js';
import logger from '../utils/logger.js';

class RAGService {
    constructor() {
        this.maxContextChunks = parseInt(process.env.MAX_CONTEXT_CHUNKS) || 5;
        this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.7;
        this.useReranking = process.env.USE_RERANKING === 'true';
    }

    async retrieveRelevantContext(query, options = {}) {
        try {
            const {
                topK = this.maxContextChunks * 2, // Get more for reranking
                filter = {},
                useReranking = this.useReranking
            } = options;

            // Search for similar vectors
            const searchResults = await vectorService.searchSimilar(query, {
                topK: useReranking ? topK * 2 : topK,
                filter,
                includeMetadata: true
            });

            if (searchResults.length === 0) {
                logger.info('No relevant context found for query');
                return '';
            }

            // Use Cohere's reranking for better results
            let finalResults = searchResults;
            if (useReranking && searchResults.length > 3) {
                const documents = searchResults.map(r => r.content);
                const reranked = await llmService.rerankDocuments(query, documents, {
                    topN: topK
                });
                
                finalResults = reranked
                    .filter(r => r.relevanceScore >= this.similarityThreshold)
                    .map(r => searchResults[r.index]);
            }

            // Take top results
            const topResults = finalResults.slice(0, this.maxContextChunks);

            // Format context
            const context = topResults.map((result, index) => {
                const sourceInfo = result.metadata.sourceType 
                    ? `[Source: ${result.metadata.sourceType}`
                    : '[Source: Knowledge Base';
                
                const scoreInfo = result.score ? `, Relevance: ${(result.score * 100).toFixed(1)}%]` : ']';
                
                return `${sourceInfo}${scoreInfo}:\n${result.content}\n`;
            }).join('\n');

            // Validate context size
            const isValidSize = await llmService.validateContextSize(context);
            if (!isValidSize) {
                logger.warn('Context too large, truncating...');
                return context.substring(0, 8000);
            }

            logger.info(`Retrieved ${topResults.length} context chunks for query`);
            return context;
            
        } catch (error) {
            logger.error('Context retrieval error:', error);
            throw error;
        }
    }

    async generateAnswer(query, chatHistory = [], options = {}) {
        try {
            const {
                useRAG = true,
                stream = false,
                model = 'command-r-plus',
                temperature = 0.7,
                useReranking = this.useReranking
            } = options;

            let context = '';
            let contextReferences = [];

            if (useRAG) {
                // Retrieve relevant context
                const searchResults = await vectorService.searchSimilar(query, {
                    includeMetadata: true,
                    topK: useReranking ? 20 : 10
                });

                // Apply reranking if enabled
                let finalResults = searchResults;
                if (useReranking && searchResults.length > 2) {
                    const documents = searchResults.map(r => r.content);
                    const reranked = await llmService.rerankDocuments(query, documents, {
                        topN: this.maxContextChunks
                    });
                    
                    finalResults = reranked
                        .filter(r => r.relevanceScore >= this.similarityThreshold)
                        .map(r => searchResults[r.index]);
                } else {
                    // Filter by similarity threshold
                    finalResults = searchResults
                        .filter(r => r.score >= this.similarityThreshold)
                        .slice(0, this.maxContextChunks);
                }

                if (finalResults.length > 0) {
                    context = finalResults.map((result, index) => {
                        contextReferences.push({
                            sourceId: result.metadata.sourceId || result.id,
                            sourceType: result.metadata.sourceType || 'unknown',
                            chunkId: result.id,
                            similarityScore: result.score || 0.5
                        });
                        
                        const relevance = result.score ? ` (Relevance: ${(result.score * 100).toFixed(1)}%)` : '';
                        return `[Source ${index + 1}${relevance}]:\n${result.content}\n`;
                    }).join('\n');
                }
            }

            // Prepare chat history
            const messages = chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // Add current query
            messages.push({ role: 'user', content: query });

            // Generate response with Cohere
            const response = await llmService.generateResponse(messages, context, {
                model,
                temperature,
                stream
            });

            return {
                answer: response.content || response,
                contextReferences,
                tokens: response.tokens || 0,
                hasContext: contextReferences.length > 0,
                usedReranking: useReranking
            };
            
        } catch (error) {
            logger.error('RAG answer generation error:', error);
            throw error;
        }
    }

    // Process document with Cohere-specific optimizations
    async processDocument(documentText, metadata = {}) {
        try {
            // Split document into chunks optimized for Cohere
            const chunks = this.splitIntoChunks(documentText, 500, 50); // Smaller chunks for Cohere
            
            logger.info(`Document split into ${chunks.length} chunks for Cohere processing`);

            const results = [];
            
            // Process each chunk with batch embedding
            const embeddings = await embeddingService.generateBatchEmbeddings(chunks, {
                inputType: 'search_document'
            });

            // Store each embedding
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const embedding = embeddings[i];
                
                // Store embedding in vector database
                const result = await vectorService.storeEmbedding(chunk, {
                    ...metadata,
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    embeddingModel: aiConfig.getEmbedModel()
                });

                results.push({
                    chunkIndex: i,
                    embeddingId: result.embeddingId,
                    chunkPreview: chunk.substring(0, 100) + '...'
                });
            }

            logger.info(`Document processed with Cohere: ${chunks.length} embeddings stored`);
            return {
                success: true,
                totalChunks: chunks.length,
                embeddingModel: aiConfig.getEmbedModel(),
                results
            };
            
        } catch (error) {
            logger.error('Document processing error:', error);
            throw error;
        }
    }

    splitIntoChunks(text, chunkSize = 500, overlap = 50) {
        const chunks = [];
        let start = 0;
        
        while (start < text.length) {
            let end = start + chunkSize;
            
            // Try to break at sentence end
            if (end < text.length) {
                const sentenceBreaks = ['. ', '! ', '? ', '\n\n', '\n', ' '];
                let foundBreak = false;
                
                for (const breakStr of sentenceBreaks) {
                    const breakIndex = text.lastIndexOf(breakStr, end);
                    if (breakIndex > start + chunkSize * 0.7) { // Only break if reasonable
                        end = breakIndex + breakStr.length;
                        foundBreak = true;
                        break;
                    }
                }
                
                // If no good break found, break at word boundary
                if (!foundBreak && end < text.length) {
                    const lastSpace = text.lastIndexOf(' ', end);
                    if (lastSpace > start) {
                        end = lastSpace + 1;
                    }
                }
            }
            
            const chunk = text.substring(start, Math.min(end, text.length)).trim();
            if (chunk.length > 20) { // Ignore very small chunks
                chunks.push(chunk);
            }
            
            start = end - overlap;
            if (start < 0) start = 0;
        }
        
        return chunks;
    }

    // Generate multiple search queries from user query (query expansion)
    async generateSearchQueries(query) {
        try {
            const prompt = `Generate 3 different search queries based on this question: "${query}"\n\nQueries:`;
            
            const response = await llmService.generateResponse(
                [{ role: 'user', content: prompt }],
                '',
                { model: 'command', temperature: 0.8 }
            );
            
            // Parse the response to get queries
            const queries = response.content
                .split('\n')
                .map(q => q.replace(/^\d+\.\s*/, '').trim())
                .filter(q => q.length > 0);
            
            // Add original query
            queries.unshift(query);
            
            // Remove duplicates
            return [...new Set(queries)].slice(0, 4);
            
        } catch (error) {
            logger.error('Search query generation error:', error);
            return [query]; // Fallback to original query
        }
    }

    // Hybrid search: Combine vector search with keyword search
    async hybridSearch(query, options = {}) {
        try {
            // Generate multiple queries for better coverage
            const searchQueries = await this.generateSearchQueries(query);
            
            const allResults = [];
            
            // Search for each query
            for (const searchQuery of searchQueries) {
                const results = await vectorService.searchSimilar(searchQuery, {
                    topK: options.topK || 3,
                    includeMetadata: true
                });
                
                allResults.push(...results);
            }
            
            // Deduplicate by content
            const uniqueResults = [];
            const seenContent = new Set();
            
            for (const result of allResults) {
                const contentHash = result.content.substring(0, 100);
                if (!seenContent.has(contentHash)) {
                    seenContent.add(contentHash);
                    uniqueResults.push(result);
                }
            }
            
            // Rerank combined results
            if (uniqueResults.length > 1) {
                const documents = uniqueResults.map(r => r.content);
                const reranked = await llmService.rerankDocuments(query, documents, {
                    topN: options.topK || this.maxContextChunks
                });
                
                return reranked.map(r => uniqueResults[r.index]);
            }
            
            return uniqueResults.slice(0, options.topK || this.maxContextChunks);
            
        } catch (error) {
            logger.error('Hybrid search error:', error);
            // Fallback to regular search
            return vectorService.searchSimilar(query, options);
        }
    }
}

const ragService = new RAGService();
export default ragService;