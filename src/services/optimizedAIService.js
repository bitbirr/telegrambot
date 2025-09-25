// =====================================================
// eQabo.com AI Optimization - Optimized AI Service
// RAG + Caching + Query Classification + Fallback
// =====================================================

import crypto from 'crypto';
import supabase from '../supabase.js';
import openai from '../openai.js';
import embeddingsService from './embeddingsService.js';
import resilienceService from './resilienceService.js';
import aiProviderManager from './aiProviderManager.js';
import { logEvent } from './logService.js';

/**
 * Optimized AI Service for cost-effective query handling
 * Implements multiple optimization strategies to reduce OpenAI usage
 */
class OptimizedAIService {
    constructor() {
        // Query classification patterns
        this.patterns = {
            greeting: /^(hi|hello|hey|good morning|good afternoon|good evening|salam|selam|nagayu|akkam|peace)/i,
            booking: /(book|reserve|hotel|room|stay|check.?in|check.?out|guest|night)/i,
            payment: /(pay|payment|telebirr|chappa|ebirr|cbe|money|cost|price)/i,
            location: /(addis|bahir|dire|gondar|mekelle|hawassa|jimma|adama|city|where|location)/i,
            help: /(help|support|problem|issue|question|how|what|why|when)/i,
            cancel: /(cancel|stop|exit|quit|no|nevermind)/i
        };

        // Predefined responses for common patterns
        this.fallbackResponses = {
            greeting: {
                en: "Hello! Welcome to eQabo.com 🏨 I'm here to help you find and book the perfect hotel in Ethiopia. How can I assist you today?",
                am: "ሰላም! ወደ eQabo.com እንኳን በደህና መጡ 🏨 በኢትዮጵያ ውስጥ ፍጹም የሆነ ሆቴል እንዲያገኙ እና እንዲያስይዙ ለመርዳት እዚህ ነኝ። ዛሬ እንዴት ልረዳዎት እችላለሁ?",
                so: "Salaan! Ku soo dhawoow eQabo.com 🏨 Waxaan halkan u joogaa si aan kaaga caawiyo inaad hesho oo aad buuxiso hotel fiican oo ku yaal Itoobiya. Sidee baan maanta kaaga caawin karaa?",
                or: "Nagayu! Gara eQabo.com baga nagattan 🏨 Itoophiyaa keessatti mana keessummaa gaarii argachuu fi qabachuuf isin gargaaruuf asii jira. Har'a akkamiin isin gargaaruu danda'a?",
                ti: "ሰላም! ናብ eQabo.com እንቋዕ ብደሓን መጻእኩም 🏨 ኣብ ኢትዮጵያ ዝበለጸ ሆቴል ክትረኽቡን ክትሕዙን ንምሕጋዝ ኣብዚ ኣለኹ። ሎሚ ብኸመይ ክሕግዘኩም እኽእል?",
                aa: "Salam! eQabo.com-h maqaak! 🏨 Itoobiyaah wayta hotel geysa rakubak woh qanubak giddigeh marah itteh. Taqwa akkeh giddigeh danay?"
            },
            help: {
                en: "I can help you with:\n🔍 Finding hotels in Ethiopian cities\n📅 Booking rooms\n💳 Payment options\n❓ General questions about travel\n\nWhat would you like to know?",
                am: "እኔ በሚከተሉት ልረዳዎት እችላለሁ:\n🔍 በኢትዮጵያ ከተሞች ውስጥ ሆቴሎችን ማግኘት\n📅 ክፍሎችን ማስያዝ\n💳 የክፍያ አማራጮች\n❓ ስለ ጉዞ አጠቃላይ ጥያቄዎች\n\nምን ማወቅ ይፈልጋሉ?",
                so: "Waxaan kaaga caawin karaa:\n🔍 Helitaanka hotelada magaalooyinka Itoobiya\n📅 Buuxinta qolal\n💳 Ikhtiyaarada lacag bixinta\n❓ Su'aalaha guud ee safarka\n\nMaxaad jeclaan lahayd inaad ogaato?",
                or: "Ani kanaan isin gargaaruu nan danda'a:\n🔍 Magaaloota Itoophiyaa keessatti mana keessummaa argachuu\n📅 Kutaalee qabachuu\n💳 Filannoo kaffaltii\n❓ Waa'ee imala gaaffii waliigalaa\n\nMaal beekuu barbaaddu?",
                ti: "ብዞም ክሕግዘኩም እኽእል:\n🔍 ኣብ ከተማታት ኢትዮጵያ ሆቴላት ምርካብ\n📅 ክፍልታት ምሕዛዝ\n💳 ናይ ክፍሊት ኣማራጺታት\n❓ ብዛዕባ ጉዕዞ ሓፈሻዊ ሕቶታት\n\nእንታይ ክትፈልጡ ትደልዩ?",
                aa: "Ani kee giddigeh danay:\n🔍 Itoobiyaah magaala keeh hotel rakubak\n📅 Qol qanubak\n💳 Lacag bixinta ikhtiyaar\n❓ Safar gaafata guud\n\nMaxa ogaan jeclaan?"
            },
            booking: {
                en: "Great! I'd love to help you book a hotel. To get started, please use the main menu and select '🔍 Search Hotels' to browse available options in different Ethiopian cities.",
                am: "በጣም ጥሩ! ሆቴል እንዲያስይዙ ልረዳዎት እወዳለሁ። ለመጀመር፣ እባክዎ ዋናውን ሜኑ ይጠቀሙ እና '🔍 ሆቴሎችን ይፈልጉ' ን ይምረጡ በተለያዩ የኢትዮጵያ ከተሞች ውስጥ ያሉ አማራጮችን ለማሰስ።",
                so: "Fiican! Waxaan jeclaan lahaa inaan kaaga caawiyo buuxinta hotel. Si aad u bilowdo, fadlan isticmaal menu-ga ugu weyn oo dooro '🔍 Raadi Hotelladda' si aad u baadho ikhtiyaarada la heli karo magaalooyinka kala duwan ee Itoobiya.",
                or: "Gaarii! Mana keessummaa akka qabattan isin gargaaruuf nan hawwa. Jalqabuuf, maaloo menu ijoo fayyadamaa fi '🔍 Mana keessummaa Barbaadi' filadhaatii magaaloota Itoophiyaa adda addaa keessatti filannoo jiran qorannaa.",
                ti: "ብሉጽ! ሆቴል ክትሕዙ ክሕግዘኩም እፈቱ። ንምጅማር፣ በጃኹም ቀንዲ ሜኑ ተጠቐሙን '🔍 ሆቴላት ድለዩ' ምረጹን ኣብ ዝተፈላለዩ ከተማታት ኢትዮጵያ ዘለዉ ኣማራጺታት ንምድህሳስ።",
                aa: "Fiican! Hotel qanubak giddigeh danay. Bilowgah, fadlan menu weyn isticmaal oo dooro '🔍 Hotel raadi' si aad u baadho ikhtiyaarada magaalooyinka Itoobiya."
            }
        };

        // Cost tracking
        this.costs = {
            embedding: 0.00002, // per 1K tokens for text-embedding-3-small
            gpt4oMini: 0.00015, // per 1K input tokens
            gpt4oMiniOutput: 0.0006 // per 1K output tokens
        };

        // Initialize AI Provider Manager with OpenAI service
        this.initializeAIProviderManager();
    }

    /**
     * Initialize AI Provider Manager with OpenAI service
     */
    initializeAIProviderManager() {
        if (openai) {
            // Create a wrapper for OpenAI to match the expected interface
            const openaiService = {
                generateResponse: async (prompt, options = {}) => {
                    const systemPrompt = this.buildSystemPrompt(options.language || 'en', options.context);
                    
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 150,
                        temperature: 0.7
                    });

                    return response.choices[0].message.content;
                },
                generateEmbedding: async (text, options = {}) => {
                    const response = await openai.embeddings.create({
                        model: 'text-embedding-3-small',
                        input: text
                    });
                    return response.data[0].embedding;
                },
                analyzeImage: async (prompt, imageUrl, options = {}) => {
                    const response = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: prompt },
                                    { type: 'image_url', image_url: { url: imageUrl } }
                                ]
                            }
                        ],
                        max_tokens: 150
                    });
                    return response.choices[0].message.content;
                },
                getHealthStatus: async () => {
                    return { status: 'healthy', service: 'OpenAI' };
                }
            };

            aiProviderManager.setOpenAIService(openaiService);
        }
    }

    /**
     * Main query processing function with optimization strategies
     * @param {string} query - User query
     * @param {string} language - User language
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Response with metadata
     */
    async processQuery(query, language = 'en', userId = null) {
        const startTime = Date.now();
        let response = null;
        let method = 'unknown';
        let tokensUsed = 0;
        let costEstimate = 0;

        try {
            // Step 1: Check query cache
            const cachedResponse = await this.checkQueryCache(query, language);
            if (cachedResponse) {
                method = 'cached';
                response = cachedResponse.response_text;
                await this.updateCacheHitCount(cachedResponse.id);
            } else {
                // Step 2: Classify query type
                const queryType = this.classifyQuery(query);

                // Step 3: Try fallback responses for simple patterns
                if (queryType && this.fallbackResponses[queryType]) {
                    const fallbackResponse = this.fallbackResponses[queryType][language] || 
                                           this.fallbackResponses[queryType]['en'];
                    if (fallbackResponse) {
                        method = 'fallback';
                        response = fallbackResponse;
                    }
                }

                // Step 4: Try semantic search in knowledge base
                if (!response) {
                    const semanticResults = await embeddingsService.searchKnowledgeBaseSemantic(
                        query, language, 0.8, 3
                    );
                    
                    if (semanticResults && semanticResults.length > 0) {
                        method = 'semantic_search';
                        response = semanticResults[0].message;
                        tokensUsed = this.estimateTokens(query); // Only for embedding
                        costEstimate = (tokensUsed / 1000) * this.costs.embedding;
                    }
                }

                // Step 5: Try hotel semantic search for booking-related queries
                if (!response && queryType === 'booking') {
                    const hotelResults = await embeddingsService.searchHotelsSemantic(
                        query, language, 0.7, 5
                    );
                    
                    if (hotelResults && hotelResults.length > 0) {
                        method = 'hotel_semantic_search';
                        response = this.formatHotelSearchResults(hotelResults, language);
                        tokensUsed = this.estimateTokens(query);
                        costEstimate = (tokensUsed / 1000) * this.costs.embedding;
                    }
                }

                // Step 6: Fallback to AI providers for complex queries
                if (!response) {
                    const aiResponse = await this.generateAIResponse(query, language, queryType, userId);
                    if (aiResponse) {
                        method = 'ai_generated';
                        response = aiResponse.content;
                        tokensUsed = aiResponse.tokensUsed;
                        costEstimate = aiResponse.costEstimate;
                    }
                }

                // Step 7: Final fallback
                if (!response) {
                    method = 'final_fallback';
                    response = this.getFinalFallbackResponse(language);
                }

                // Cache the response if it's not from AI (to avoid caching potentially incorrect responses)
                if (response && method !== 'ai_generated') {
                    await this.cacheQuery(query, language, response, method);
                }
            }

            const responseTime = Date.now() - startTime;

            // Log analytics
            await this.logUsageAnalytics(userId, query, language, method, tokensUsed, costEstimate, responseTime);

            return {
                response,
                method,
                tokensUsed,
                costEstimate,
                responseTime
            };

        } catch (error) {
            await logEvent('error', 'Optimized AI service error', {
                context: 'optimized_ai_service',
                user_id: userId,
                query: query.substring(0, 100),
                language,
                error: error.message
            });

            return {
                response: this.getFinalFallbackResponse(language),
                method: 'error_fallback',
                tokensUsed: 0,
                costEstimate: 0,
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * Check query cache for existing responses
     * @param {string} query - User query
     * @param {string} language - User language
     * @returns {Promise<Object|null>} - Cached response or null
     */
    async checkQueryCache(query, language) {
        try {
            const queryHash = this.hashQuery(query);
            
            const { data, error } = await supabase
                .from('query_cache')
                .select('*')
                .eq('query_hash', queryHash)
                .eq('language', language)
                .single();

            if (error || !data) {
                return null;
            }

            // Check if cache entry is still fresh (7 days)
            const cacheAge = Date.now() - new Date(data.last_used).getTime();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

            if (cacheAge > maxAge) {
                // Remove stale cache entry
                await supabase.from('query_cache').delete().eq('id', data.id);
                return null;
            }

            return data;

        } catch (error) {
            await logEvent('error', 'Query cache check failed', {
                context: 'optimized_ai_service',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Cache a query and response
     * @param {string} query - User query
     * @param {string} language - User language
     * @param {string} response - Response text
     * @param {string} method - Resolution method
     */
    async cacheQuery(query, language, response, method) {
        try {
            const queryHash = this.hashQuery(query);

            await supabase.from('query_cache').upsert({
                query_hash: queryHash,
                query_text: query,
                language,
                response_text: response,
                response_type: method,
                last_used: new Date().toISOString()
            });

        } catch (error) {
            await logEvent('error', 'Query caching failed', {
                context: 'optimized_ai_service',
                error: error.message
            });
        }
    }

    /**
     * Update cache hit count
     * @param {string} cacheId - Cache entry ID
     */
    async updateCacheHitCount(cacheId) {
        try {
            await supabase.rpc('increment_cache_hit_count', { cache_id: cacheId });
        } catch (error) {
            // Non-critical error, just log it
            await logEvent('warning', 'Cache hit count update failed', {
                context: 'optimized_ai_service',
                cache_id: cacheId,
                error: error.message
            });
        }
    }

    /**
     * Classify query type based on patterns
     * @param {string} query - User query
     * @returns {string|null} - Query type or null
     */
    classifyQuery(query) {
        const queryLower = query.toLowerCase();
        
        for (const [type, pattern] of Object.entries(this.patterns)) {
            if (pattern.test(queryLower)) {
                return type;
            }
        }
        
        return null;
    }

    /**
     * Generate AI response using AI Provider Manager with automatic fallback
     * @param {string} query - User query
     * @param {string} language - User language
     * @param {string} queryType - Classified query type
     * @param {string} userId - User ID for provider preferences
     * @returns {Promise<Object>} - AI response with metadata
     */
    async generateAIResponse(query, language, queryType, userId = null) {
        try {
            await logEvent('info', 'Generating AI response with provider fallback', {
                context: 'optimized_ai_service',
                query_type: queryType,
                language,
                user_id: userId,
                query_length: query.length
            });

            // Use AI Provider Manager for automatic fallback between providers
            const result = await aiProviderManager.generateResponse(query, language, userId, {
                context: queryType,
                max_tokens: 150,
                temperature: 0.7
            });

            // Calculate cost estimate based on provider used
            let costEstimate = 0;
            let tokensUsed = this.estimateTokens(query + result.response);

            if (result.provider === 'OpenAI') {
                // Estimate OpenAI costs
                const inputTokens = this.estimateTokens(query);
                const outputTokens = this.estimateTokens(result.response);
                costEstimate = (inputTokens / 1000) * this.costs.gpt4oMini +
                              (outputTokens / 1000) * this.costs.gpt4oMiniOutput;
            } else {
                // Puter.js is free
                costEstimate = 0;
            }

            await logEvent('info', 'AI response generated successfully', {
                context: 'optimized_ai_service',
                provider: result.provider,
                cost_model: result.costModel,
                response_time_ms: result.responseTime,
                fallback_used: result.fallbackUsed,
                attempted_providers: result.attemptedProviders,
                tokens_used: tokensUsed,
                cost_estimate: costEstimate
            });

            return {
                content: result.response,
                tokensUsed: tokensUsed,
                costEstimate: costEstimate,
                provider: result.provider,
                fallbackUsed: result.fallbackUsed,
                responseTime: result.responseTime
            };

        } catch (error) {
            await logEvent('error', 'AI response generation failed with all providers', {
                context: 'optimized_ai_service',
                error: error.message,
                query: query.substring(0, 100),
                language,
                user_id: userId
            });

            // Final fallback to knowledge base error message
            const errorMessage = await resilienceService.getGracefulErrorMessage('error', language);
            return {
                content: errorMessage,
                tokensUsed: 0,
                costEstimate: 0,
                provider: 'fallback',
                fallbackUsed: true,
                responseTime: 0
            };
        }
    }

    /**
     * Build system prompt based on language and query type
     * @param {string} language - User language
     * @param {string} queryType - Query type
     * @returns {string} - System prompt
     */
    buildSystemPrompt(language, queryType) {
        const basePrompt = `You are eQabo.com's hotel booking assistant for Ethiopia. Respond in ${language === 'en' ? 'English' : 'Amharic'}. Keep responses concise and helpful.`;
        
        const typeSpecificPrompts = {
            booking: ' Focus on hotel booking assistance and guide users to use the menu options.',
            payment: ' Provide information about Ethiopian payment methods: Telebirr, Chappa, eBirr, and CBE Birr.',
            location: ' Provide information about Ethiopian cities and travel destinations.',
            help: ' Provide helpful guidance about using the bot and booking hotels.'
        };

        return basePrompt + (typeSpecificPrompts[queryType] || ' Focus on hotel booking and Ethiopian travel.');
    }

    /**
     * Format hotel search results
     * @param {Array} hotels - Hotel search results
     * @param {string} language - User language
     * @returns {string} - Formatted response
     */
    formatHotelSearchResults(hotels, language) {
        const intro = language === 'en' ? 
            '🏨 I found these hotels that might interest you:' :
            '🏨 እነዚህ ሆቴሎች ሊያስደስቱዎት ይችላሉ:';

        const hotelList = hotels.slice(0, 3).map(hotel => {
            const stars = '⭐'.repeat(hotel.rating);
            return `\n\n${hotel.name} ${stars}\n📍 ${hotel.city_name}\n💰 ${hotel.price_per_night} ETB/night`;
        }).join('');

        const outro = language === 'en' ?
            '\n\nUse the main menu to book or see more options!' :
            '\n\nለማስያዝ ወይም ተጨማሪ አማራጮችን ለማየት ዋናውን ሜኑ ይጠቀሙ!';

        return intro + hotelList + outro;
    }

    /**
     * Get final fallback response
     * @param {string} language - User language
     * @returns {string} - Fallback response
     */
    getFinalFallbackResponse(language) {
        const responses = {
            en: "I'm here to help with hotel bookings in Ethiopia! Please use the menu options or ask me about hotels, cities, or booking assistance.",
            am: "በኢትዮጵያ ውስጥ ሆቴል ማስያዝ ለመርዳት እዚህ ነኝ! እባክዎ የሜኑ አማራጮችን ይጠቀሙ ወይም ስለ ሆቴሎች፣ ከተሞች ወይም የማስያዝ እርዳታ ይጠይቁኝ።",
            so: "Waxaan halkan u joogaa si aan kaaga caawiyo buuxinta hotelada Itoobiya! Fadlan isticmaal ikhtiyaarada menu-ga ama i weydii wax ku saabsan hotelada, magaalooyinka, ama caawinta buuxinta.",
            or: "Itoophiyaa keessatti mana keessummaa qabachuuf gargaaruuf asii jira! Maaloo filannoo menu fayyadamaa ykn waa'ee mana keessummaa, magaaloota, ykn gargaarsa qabachuu na gaafadhaa.",
            ti: "ኣብ ኢትዮጵያ ሆቴል ንምሕዛዝ ንምሕጋዝ ኣብዚ ኣለኹ! በጃኹም ናይ ሜኑ ኣማራጺታት ተጠቐሙ ወይ ብዛዕባ ሆቴላት፣ ከተማታት፣ ወይ ናይ ምሕዛዝ ሓገዝ ሕተቱኒ።",
            aa: "Itoobiyaah hotel qanubak giddigeh marah itteh! Fadlan menu ikhtiyaar isticmaal ama hotel, magaala, ama qanubak gargaar gaafadh."
        };

        return responses[language] || responses['en'];
    }

    /**
     * Log usage analytics
     * @param {string} userId - User ID
     * @param {string} query - User query
     * @param {string} language - User language
     * @param {string} method - Resolution method
     * @param {number} tokensUsed - Tokens used
     * @param {number} costEstimate - Cost estimate
     * @param {number} responseTime - Response time in ms
     */
    async logUsageAnalytics(userId, query, language, method, tokensUsed, costEstimate, responseTime) {
        try {
            await supabase.from('ai_usage_analytics').insert({
                user_id: userId,
                query_text: query.substring(0, 500), // Limit query text length
                language,
                resolution_method: method,
                tokens_used: tokensUsed,
                response_time_ms: responseTime,
                cost_estimate: costEstimate
            });

        } catch (error) {
            await logEvent('error', 'Usage analytics logging failed', {
                context: 'optimized_ai_service',
                error: error.message
            });
        }
    }

    /**
     * Generate hash for query normalization
     * @param {string} query - User query
     * @returns {string} - Query hash
     */
    hashQuery(query) {
        // Normalize query: lowercase, remove extra spaces, remove punctuation
        const normalized = query.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * Estimate token count for text
     * @param {string} text - Text to estimate
     * @returns {number} - Estimated token count
     */
    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters for most languages
        return Math.ceil(text.length / 4);
    }

    /**
     * Get optimization statistics
     * @returns {Promise<Object>} - Optimization statistics
     */
    async getOptimizationStats() {
        try {
            const { data: stats } = await supabase
                .from('ai_usage_analytics')
                .select('resolution_method, tokens_used, cost_estimate')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const summary = {
                total_queries: stats?.length || 0,
                methods: {},
                total_tokens: 0,
                total_cost: 0,
                optimization_rate: 0
            };

            if (stats) {
                stats.forEach(stat => {
                    summary.methods[stat.resolution_method] = (summary.methods[stat.resolution_method] || 0) + 1;
                    summary.total_tokens += stat.tokens_used || 0;
                    summary.total_cost += parseFloat(stat.cost_estimate || 0);
                });

                const optimizedQueries = (summary.methods.cached || 0) + 
                                       (summary.methods.fallback || 0) + 
                                       (summary.methods.semantic_search || 0);
                
                summary.optimization_rate = summary.total_queries > 0 ? 
                    (optimizedQueries / summary.total_queries) * 100 : 0;
            }

            return summary;

        } catch (error) {
            await logEvent('error', 'Failed to get optimization stats', {
                context: 'optimized_ai_service',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Set user AI provider preference
     * @param {string} userId - User ID
     * @param {string} provider - Preferred provider (openai, puter)
     * @returns {Promise<boolean>} - Success status
     */
    async setUserAIProviderPreference(userId, provider) {
        try {
            aiProviderManager.setUserPreference(userId, provider);
            
            await logEvent('info', 'User AI provider preference updated', {
                context: 'optimized_ai_service',
                user_id: userId,
                preferred_provider: provider
            });

            return true;
        } catch (error) {
            await logEvent('error', 'Failed to set user AI provider preference', {
                context: 'optimized_ai_service',
                user_id: userId,
                provider,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get user AI provider preference
     * @param {string} userId - User ID
     * @returns {string} - Preferred provider
     */
    getUserAIProviderPreference(userId) {
        return aiProviderManager.getUserPreference(userId);
    }

    /**
     * Get available AI providers for a capability
     * @param {string} capability - Required capability (chat, image_analysis, embeddings)
     * @returns {Array} - Available providers
     */
    getAvailableAIProviders(capability = 'chat') {
        return aiProviderManager.getAvailableProviders(capability);
    }

    /**
     * Get AI provider status and health information
     * @returns {Promise<Object>} - Provider status
     */
    async getAIProviderStatus() {
        try {
            const status = await aiProviderManager.getProviderStatus();
            
            await logEvent('info', 'AI provider status retrieved', {
                context: 'optimized_ai_service',
                providers_count: Object.keys(status.providers).length,
                default_provider: status.defaultProvider,
                fallback_enabled: status.fallbackEnabled
            });

            return status;
        } catch (error) {
            await logEvent('error', 'Failed to get AI provider status', {
                context: 'optimized_ai_service',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Enable or disable AI provider fallback
     * @param {boolean} enabled - Whether fallback is enabled
     */
    setAIProviderFallback(enabled) {
        aiProviderManager.setFallbackEnabled(enabled);
        
        logEvent('info', 'AI provider fallback setting updated', {
            context: 'optimized_ai_service',
            fallback_enabled: enabled
        });
    }

    /**
     * Analyze image using AI providers with fallback
     * @param {string} prompt - Prompt about the image
     * @param {string} imageUrl - Image URL
     * @param {string} userId - User ID
     * @param {string} language - Language code
     * @returns {Promise<Object>} - Analysis result with metadata
     */
    async analyzeImage(prompt, imageUrl, userId = null, language = 'en') {
        const startTime = Date.now();
        
        try {
            await logEvent('info', 'Starting image analysis with AI providers', {
                context: 'optimized_ai_service',
                user_id: userId,
                prompt_length: prompt.length,
                language
            });

            const result = await aiProviderManager.analyzeImage(prompt, imageUrl, userId, {
                language,
                max_tokens: 150
            });

            const responseTime = Date.now() - startTime;

            await logEvent('info', 'Image analysis completed successfully', {
                context: 'optimized_ai_service',
                provider: result.provider,
                cost_model: result.costModel,
                response_time_ms: responseTime,
                fallback_used: result.fallbackUsed,
                attempted_providers: result.attemptedProviders
            });

            return {
                analysis: result.analysis,
                provider: result.provider,
                costModel: result.costModel,
                responseTime: responseTime,
                fallbackUsed: result.fallbackUsed,
                attemptedProviders: result.attemptedProviders
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            await logEvent('error', 'Image analysis failed with all providers', {
                context: 'optimized_ai_service',
                error: error.message,
                user_id: userId,
                response_time_ms: responseTime
            });

            // Return fallback response
            const fallbackMessage = await resilienceService.getGracefulErrorMessage('error', language);
            return {
                analysis: fallbackMessage,
                provider: 'fallback',
                costModel: 'free',
                responseTime: responseTime,
                fallbackUsed: true,
                attemptedProviders: ['error']
            };
        }
    }
}

// Create singleton instance
const optimizedAIService = new OptimizedAIService();

export default optimizedAIService;