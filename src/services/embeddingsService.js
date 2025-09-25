// =====================================================
// eQabo.com AI Optimization - Embeddings Service
// Generate and manage vector embeddings for semantic search
// =====================================================

import crypto from 'crypto';
import supabase from '../supabase.js';
import openai from '../openai.js';
import resilienceService from './resilienceService.js';
import { logEvent } from './logService.js';

/**
 * Embeddings Service for AI optimization
 * Handles vector embeddings generation and semantic search
 */
class EmbeddingsService {
    constructor() {
        this.embeddingModel = 'text-embedding-3-small'; // 1536 dimensions, cost-effective
        this.batchSize = 100; // Process embeddings in batches
        this.cache = new Map(); // In-memory cache for recent embeddings
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes cache
    }

    /**
     * Generate embedding for text using OpenAI
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} - Embedding vector
     */
    async generateEmbedding(text) {
        try {
            if (!openai) {
                throw new Error('OpenAI client not available');
            }

            // Check cache first
            const cacheKey = this.hashText(text);
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    return cached.embedding;
                }
            }

            // Use circuit breaker for OpenAI API call
            const response = await resilienceService.withCircuitBreaker('openai_embeddings', async () => {
                return await openai.embeddings.create({
                    model: this.embeddingModel,
                    input: text.substring(0, 8000), // Limit input length
                    encoding_format: 'float'
                });
            });

            const embedding = response.data[0].embedding;

            // Cache the result
            this.cache.set(cacheKey, {
                embedding,
                timestamp: Date.now()
            });

            await logEvent('info', 'Embedding generated successfully', {
                context: 'embeddings_service',
                model: this.embeddingModel,
                text_length: text.length,
                embedding_dimensions: embedding.length
            });

            return embedding;

        } catch (error) {
            await logEvent('error', 'Failed to generate embedding', {
                context: 'embeddings_service',
                error: error.message,
                text_length: text?.length || 0
            });
            throw error;
        }
    }

    /**
     * Generate embeddings for knowledge base content
     * @param {string} language - Target language
     * @returns {Promise<number>} - Number of embeddings generated
     */
    async generateKnowledgeBaseEmbeddings(language = 'en') {
        try {
            await logEvent('info', 'Starting knowledge base embeddings generation', {
                context: 'embeddings_service',
                language
            });

            // Get all knowledge base entries for the language
            const { data: kbEntries, error: kbError } = await supabase
                .from('knowledge_base')
                .select('id, key, message, category')
                .eq('language', language);

            if (kbError) {
                throw new Error(`Failed to fetch knowledge base: ${kbError.message}`);
            }

            let generatedCount = 0;
            const batchPromises = [];

            for (let i = 0; i < kbEntries.length; i += this.batchSize) {
                const batch = kbEntries.slice(i, i + this.batchSize);
                batchPromises.push(this.processBatch(batch, 'knowledge_base'));
            }

            const results = await Promise.allSettled(batchPromises);
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    generatedCount += result.value;
                } else {
                    logEvent('error', `Batch ${index} failed`, {
                        context: 'embeddings_service',
                        error: result.reason
                    });
                }
            });

            await logEvent('info', 'Knowledge base embeddings generation completed', {
                context: 'embeddings_service',
                language,
                total_entries: kbEntries.length,
                generated_count: generatedCount
            });

            return generatedCount;

        } catch (error) {
            await logEvent('error', 'Knowledge base embeddings generation failed', {
                context: 'embeddings_service',
                language,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate embeddings for hotel data
     * @param {string} language - Target language
     * @returns {Promise<number>} - Number of embeddings generated
     */
    async generateHotelEmbeddings(language = 'en') {
        try {
            await logEvent('info', 'Starting hotel embeddings generation', {
                context: 'embeddings_service',
                language
            });

            // Get all active hotels with city information
            const { data: hotels, error: hotelsError } = await supabase
                .from('hotels')
                .select(`
                    id, name, description, amenities, price_per_night, rating,
                    cities(key, names)
                `)
                .eq('is_active', true);

            if (hotelsError) {
                throw new Error(`Failed to fetch hotels: ${hotelsError.message}`);
            }

            let generatedCount = 0;
            const batchPromises = [];

            // Prepare hotel data for embedding
            const hotelData = hotels.map(hotel => ({
                id: hotel.id,
                searchableContent: this.createHotelSearchableContent(hotel, language),
                language
            }));

            for (let i = 0; i < hotelData.length; i += this.batchSize) {
                const batch = hotelData.slice(i, i + this.batchSize);
                batchPromises.push(this.processBatch(batch, 'hotel'));
            }

            const results = await Promise.allSettled(batchPromises);
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    generatedCount += result.value;
                } else {
                    logEvent('error', `Hotel batch ${index} failed`, {
                        context: 'embeddings_service',
                        error: result.reason
                    });
                }
            });

            await logEvent('info', 'Hotel embeddings generation completed', {
                context: 'embeddings_service',
                language,
                total_hotels: hotels.length,
                generated_count: generatedCount
            });

            return generatedCount;

        } catch (error) {
            await logEvent('error', 'Hotel embeddings generation failed', {
                context: 'embeddings_service',
                language,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Process a batch of items for embedding generation
     * @param {Array} batch - Batch of items to process
     * @param {string} type - Type of items ('knowledge_base' or 'hotel')
     * @returns {Promise<number>} - Number of embeddings generated
     */
    async processBatch(batch, type) {
        let generatedCount = 0;

        for (const item of batch) {
            try {
                if (type === 'knowledge_base') {
                    await this.processKnowledgeBaseItem(item);
                } else if (type === 'hotel') {
                    await this.processHotelItem(item);
                }
                generatedCount++;
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                await logEvent('error', `Failed to process ${type} item`, {
                    context: 'embeddings_service',
                    item_id: item.id,
                    error: error.message
                });
            }
        }

        return generatedCount;
    }

    /**
     * Process a single knowledge base item
     * @param {Object} item - Knowledge base item
     */
    async processKnowledgeBaseItem(item) {
        const content = `${item.key}: ${item.message}`;
        const contentHash = this.hashText(content);

        // Check if embedding already exists and is up to date
        const { data: existing } = await supabase
            .from('knowledge_base_embeddings')
            .select('content_hash')
            .eq('knowledge_base_id', item.id)
            .single();

        if (existing && existing.content_hash === contentHash) {
            return; // Skip if already up to date
        }

        const embedding = await this.generateEmbedding(content);

        // Upsert embedding
        const { error } = await supabase
            .from('knowledge_base_embeddings')
            .upsert({
                knowledge_base_id: item.id,
                embedding,
                content_hash: contentHash,
                updated_at: new Date().toISOString()
            });

        if (error) {
            throw new Error(`Failed to save knowledge base embedding: ${error.message}`);
        }
    }

    /**
     * Process a single hotel item
     * @param {Object} item - Hotel item with searchable content
     */
    async processHotelItem(item) {
        const contentHash = this.hashText(item.searchableContent);

        // Check if embedding already exists and is up to date
        const { data: existing } = await supabase
            .from('hotel_embeddings')
            .select('content_hash')
            .eq('hotel_id', item.id)
            .eq('language', item.language)
            .single();

        if (existing && existing.content_hash === contentHash) {
            return; // Skip if already up to date
        }

        const embedding = await this.generateEmbedding(item.searchableContent);

        // Upsert embedding
        const { error } = await supabase
            .from('hotel_embeddings')
            .upsert({
                hotel_id: item.id,
                embedding,
                content_hash: contentHash,
                searchable_content: item.searchableContent,
                language: item.language,
                updated_at: new Date().toISOString()
            });

        if (error) {
            throw new Error(`Failed to save hotel embedding: ${error.message}`);
        }
    }

    /**
     * Create searchable content for a hotel
     * @param {Object} hotel - Hotel object
     * @param {string} language - Target language
     * @returns {string} - Searchable content
     */
    createHotelSearchableContent(hotel, language) {
        const description = hotel.description?.[language] || hotel.description?.en || '';
        const cityName = hotel.cities?.names?.[language] || hotel.cities?.names?.en || '';
        const amenities = Array.isArray(hotel.amenities) ? hotel.amenities.join(', ') : '';
        
        return [
            hotel.name,
            description,
            `Located in ${cityName}`,
            `${hotel.rating} star hotel`,
            `Price: ${hotel.price_per_night} ETB per night`,
            amenities ? `Amenities: ${amenities}` : ''
        ].filter(Boolean).join('. ');
    }

    /**
     * Search knowledge base using semantic similarity
     * @param {string} query - Search query
     * @param {string} language - Target language
     * @param {number} threshold - Similarity threshold (0-1)
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} - Search results
     */
    async searchKnowledgeBaseSemantic(query, language = 'en', threshold = 0.8, limit = 5) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);

            const { data, error } = await supabase.rpc('search_knowledge_base_semantic', {
                query_embedding: queryEmbedding,
                target_language: language,
                similarity_threshold: threshold,
                max_results: limit
            });

            if (error) {
                throw new Error(`Semantic search failed: ${error.message}`);
            }

            await logEvent('info', 'Semantic knowledge base search completed', {
                context: 'embeddings_service',
                query: query.substring(0, 100),
                language,
                results_count: data?.length || 0,
                threshold
            });

            return data || [];

        } catch (error) {
            await logEvent('error', 'Semantic knowledge base search failed', {
                context: 'embeddings_service',
                query: query.substring(0, 100),
                language,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Search hotels using semantic similarity
     * @param {string} query - Search query
     * @param {string} language - Target language
     * @param {number} threshold - Similarity threshold (0-1)
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} - Search results
     */
    async searchHotelsSemantic(query, language = 'en', threshold = 0.7, limit = 10) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);

            const { data, error } = await supabase.rpc('search_hotels_semantic', {
                query_embedding: queryEmbedding,
                target_language: language,
                similarity_threshold: threshold,
                max_results: limit
            });

            if (error) {
                throw new Error(`Hotel semantic search failed: ${error.message}`);
            }

            await logEvent('info', 'Semantic hotel search completed', {
                context: 'embeddings_service',
                query: query.substring(0, 100),
                language,
                results_count: data?.length || 0,
                threshold
            });

            return data || [];

        } catch (error) {
            await logEvent('error', 'Semantic hotel search failed', {
                context: 'embeddings_service',
                query: query.substring(0, 100),
                language,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Generate SHA-256 hash for text
     * @param {string} text - Text to hash
     * @returns {string} - Hash string
     */
    hashText(text) {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Clear embedding cache
     */
    clearCache() {
        this.cache.clear();
        logEvent('info', 'Embeddings cache cleared', {
            context: 'embeddings_service'
        });
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            timeout: this.cacheTimeout,
            model: this.embeddingModel
        };
    }
}

// Create singleton instance
const embeddingsService = new EmbeddingsService();

export default embeddingsService;