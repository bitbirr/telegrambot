// =====================================================
// eQabo.com Telegram Bot - Database Service
// Dynamic content retrieval from Supabase
// =====================================================

import supabase from '../supabase.js';
import { logEvent } from './logService.js';
import resilienceService from './resilienceService.js';

/**
 * Database Service for dynamic content retrieval
 * Replaces hardcoded JSON with database queries
 */
class DatabaseService {
    constructor() {
        this.cache = {
            knowledgeBase: new Map(),
            cities: null,
            hotels: new Map(),
            paymentMethods: null,
            lastCacheUpdate: null
        };
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Check if cache is valid
     */
    isCacheValid() {
        return this.cache.lastCacheUpdate && 
               (Date.now() - this.cache.lastCacheUpdate) < this.cacheTimeout;
    }

    /**
     * Get knowledge base message by key and language
     * @param {string} key - Message key
     * @param {string} language - Language code (en, am, so, or, ti)
     * @returns {Promise<string>} - Localized message
     */
    async getKnowledgeBase(key, language = 'en') {
        try {
            const cacheKey = `${key}_${language}`;
            
            // Check cache first
            if (this.cache.knowledgeBase.has(cacheKey) && this.isCacheValid()) {
                return this.cache.knowledgeBase.get(cacheKey);
            }

            // Use resilience service for retry logic
            const data = await resilienceService.executeSupabaseQuery(
                () => supabase
                    .from('knowledge_base')
                    .select('message')
                    .eq('key', key)
                    .eq('language', language)
                    .single(),
                `knowledge_base_${key}_${language}`,
                null
            );

            if (!data) {
                // Fallback to English if specific language fails
                if (language !== 'en') {
                    return await this.getKnowledgeBase(key, 'en');
                }
                
                return await resilienceService.getGracefulErrorMessage(
                    (errorKey, lang) => this.getKnowledgeBase(errorKey, lang),
                    language
                );
            }

            // Cache the result
            this.cache.knowledgeBase.set(cacheKey, data.message);
            this.cache.lastCacheUpdate = Date.now();

            await logEvent('info', 'Knowledge base message retrieved', {
                key,
                language,
                cached: false
            });

            return data.message;

        } catch (error) {
            await logEvent('error', 'Knowledge base retrieval failed', {
                error: error.message,
                key,
                language
            });
            
            return await resilienceService.getGracefulErrorMessage(
                (errorKey, lang) => this.getKnowledgeBase(errorKey, lang),
                language
            );
        }
    }

    /**
     * Get all cities with localized names
     * @param {string} language - Language code
     * @returns {Promise<Array>} - Array of cities
     */
    async getCities(language = 'en') {
        try {
            // Check cache first
            if (this.cache.cities && this.isCacheValid()) {
                return this.cache.cities.map(city => ({
                    ...city,
                    name: city.names[language] || city.names.en
                }));
            }

            // Use resilience service for retry logic
            const data = await resilienceService.executeSupabaseQuery(
                () => supabase
                    .from('cities')
                    .select('*')
                    .order('names->en'),
                `cities_${language}`,
                []
            );

            if (!data || data.length === 0) {
                await logEvent('warn', 'No cities found in database', { language });
                return [];
            }

            // Cache the result
            this.cache.cities = data;
            this.cache.lastCacheUpdate = Date.now();

            await logEvent('info', 'Cities retrieved from database', {
                count: data.length,
                language,
                cached: false
            });

            return data.map(city => ({
                ...city,
                name: city.names[language] || city.names.en
            }));

        } catch (error) {
            await logEvent('error', 'Cities retrieval failed', {
                error: error.message,
                language
            });
            return [];
        }
    }

    /**
     * Get hotels for a specific city
     * @param {string} cityKey - City key
     * @param {string} language - Language code
     * @returns {Promise<Array>} - Array of hotels
     */
    async getHotels(cityKey, language = 'en') {
        try {
            const cacheKey = `${cityKey}_${language}`;
            
            // Check cache first
            if (this.cache.hotels.has(cacheKey) && this.isCacheValid()) {
                return this.cache.hotels.get(cacheKey);
            }

            // Use resilience service for retry logic
            const data = await resilienceService.executeSupabaseQuery(
                () => supabase
                    .from('hotels')
                    .select(`
                        *,
                        cities!inner(key, names)
                    `)
                    .eq('cities.key', cityKey)
                    .order('rating', { ascending: false }),
                `hotels_${cityKey}_${language}`,
                []
            );

            if (!data || data.length === 0) {
                await logEvent('warn', 'No hotels found for city', {
                    cityKey,
                    language
                });
                return [];
            }

            // Process hotels with localized descriptions
            const processedHotels = data.map(hotel => ({
                ...hotel,
                description: hotel.description[language] || hotel.description.en,
                cityName: hotel.cities.names[language] || hotel.cities.names.en
            }));

            // Cache the result
            this.cache.hotels.set(cacheKey, processedHotels);
            this.cache.lastCacheUpdate = Date.now();

            await logEvent('info', 'Hotels retrieved from database', {
                cityKey,
                count: data.length,
                language,
                cached: false
            });

            return processedHotels;

        } catch (error) {
            await logEvent('error', 'Hotels retrieval failed', {
                error: error.message,
                cityKey,
                language
            });
            return [];
        }
    }

    /**
     * Get specific hotel by ID
     * @param {string} hotelId - Hotel ID
     * @param {string} language - Language code
     * @returns {Promise<Object|null>} - Hotel object or null
     */
    async getHotel(hotelId, language = 'en') {
        try {
            const { data, error } = await supabase
                .from('hotels')
                .select(`
                    *,
                    cities(key, names)
                `)
                .eq('id', hotelId)
                .single();

            if (error) {
                await logEvent('error', 'Hotel query failed', {
                    error: error.message,
                    hotelId,
                    language
                });
                return null;
            }

            const processedHotel = {
                ...data,
                description: data.description[language] || data.description.en,
                cityName: data.cities.names[language] || data.cities.names.en
            };

            await logEvent('info', 'Hotel retrieved from database', {
                hotelId,
                hotelName: data.name,
                language
            });

            return processedHotel;

        } catch (error) {
            await logEvent('error', 'Hotel retrieval failed', {
                error: error.message,
                hotelId,
                language
            });
            return null;
        }
    }

    /**
     * Get payment methods with localized names
     * @param {string} language - Language code
     * @returns {Promise<Array>} - Array of payment methods
     */
    async getPaymentMethods(language = 'en') {
        try {
            // Check cache first
            if (this.cache.paymentMethods && this.isCacheValid()) {
                return this.cache.paymentMethods.map(method => ({
                    ...method,
                    name: method.translations[language] || method.translations.en
                }));
            }

            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .order('display_order');

            if (error) {
                await logEvent('error', 'Payment methods query failed', {
                    error: error.message,
                    language
                });
                return [];
            }

            // Cache the result
            this.cache.paymentMethods = data;
            this.cache.lastCacheUpdate = Date.now();

            await logEvent('info', 'Payment methods retrieved from database', {
                count: data.length,
                language,
                cached: false
            });

            return data.map(method => ({
                ...method,
                name: method.translations[language] || method.translations.en
            }));

        } catch (error) {
            await logEvent('error', 'Payment methods retrieval failed', {
                error: error.message,
                language
            });
            return [];
        }
    }

    /**
     * Search hotels by name or city
     * @param {string} query - Search query
     * @param {string} language - Language code
     * @returns {Promise<Array>} - Array of matching hotels
     */
    async searchHotels(query, language = 'en') {
        try {
            const { data, error } = await supabase
                .from('hotels')
                .select(`
                    *,
                    cities(key, names)
                `)
                .or(`name.ilike.%${query}%,cities.names->${language}.ilike.%${query}%`)
                .order('rating', { ascending: false })
                .limit(10);

            if (error) {
                await logEvent('error', 'Hotel search failed', {
                    error: error.message,
                    query,
                    language
                });
                return [];
            }

            const processedHotels = data.map(hotel => ({
                ...hotel,
                description: hotel.description[language] || hotel.description.en,
                cityName: hotel.cities.names[language] || hotel.cities.names.en
            }));

            await logEvent('info', 'Hotel search completed', {
                query,
                resultsCount: data.length,
                language
            });

            return processedHotels;

        } catch (error) {
            await logEvent('error', 'Hotel search failed', {
                error: error.message,
                query,
                language
            });
            return [];
        }
    }

    /**
     * Clear cache manually
     */
    clearCache() {
        this.cache = {
            knowledgeBase: new Map(),
            cities: null,
            hotels: new Map(),
            paymentMethods: null,
            lastCacheUpdate: null
        };
        
        logEvent('info', 'Database cache cleared manually');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            knowledgeBaseEntries: this.cache.knowledgeBase.size,
            citiesCached: !!this.cache.cities,
            hotelsCached: this.cache.hotels.size,
            paymentMethodsCached: !!this.cache.paymentMethods,
            lastUpdate: this.cache.lastCacheUpdate,
            isValid: this.isCacheValid()
        };
    }
}

// Create singleton instance
const databaseService = new DatabaseService();

export default databaseService;