// =====================================================
// eQabo.com AI Optimization - Cache Service
// High-performance caching for frequent queries
// =====================================================

import crypto from 'crypto';
import supabase from '../supabase.js';
import { logEvent } from './logService.js';

/**
 * Cache Service for optimizing frequent queries
 * Implements both in-memory and database caching strategies
 */
class CacheService {
    constructor() {
        // In-memory cache for ultra-fast access (optimized for lower memory usage)
        this.memoryCache = new Map();
        this.maxMemoryCacheSize = 200; // Reduced from 1000 to 200 for memory optimization
        this.memoryCacheTTL = 3 * 60 * 1000; // Reduced from 5 to 3 minutes TTL for memory cache
        
        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            memoryHits: 0,
            dbHits: 0
        };

        // Predefined cache entries for common patterns
        this.commonResponses = {
            greetings: {
                en: {
                    patterns: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
                    response: "Hello! Welcome to eQabo.com 🏨 I'm here to help you find and book the perfect hotel in Ethiopia. How can I assist you today?"
                },
                am: {
                    patterns: ['ሰላም', 'እንደምን ነህ', 'እንደምን ነሽ', 'እንደምን አለህ', 'እንደምን አለሽ'],
                    response: "ሰላም! ወደ eQabo.com እንኳን በደህና መጡ 🏨 በኢትዮጵያ ውስጥ ፍጹም የሆነ ሆቴል እንዲያገኙ እና እንዲያስይዙ ለመርዳት እዚህ ነኝ። ዛሬ እንዴት ልረዳዎት እችላለሁ?"
                },
                so: {
                    patterns: ['salaan', 'salam', 'nagayu', 'akkam'],
                    response: "Salaan! Ku soo dhawoow eQabo.com 🏨 Waxaan halkan u joogaa si aan kaaga caawiyo inaad hesho oo aad buuxiso hotel fiican oo ku yaal Itoobiya. Sidee baan maanta kaaga caawin karaa?"
                }
            },
            payment_info: {
                en: {
                    patterns: ['payment', 'pay', 'telebirr', 'chappa', 'ebirr', 'cbe', 'money', 'cost'],
                    response: "💳 Payment Methods Available:\n\n🔹 TeleBirr - Mobile payment\n🔹 Chappa - Digital wallet\n🔹 eBirr - Electronic payment\n🔹 CBE Birr - Commercial Bank of Ethiopia\n\nAll payments are secure and processed instantly!"
                },
                am: {
                    patterns: ['ክፍያ', 'ገንዘብ', 'ቴሌብር', 'ቻፓ', 'ኢብር', 'ሲቢኢ'],
                    response: "💳 የሚገኙ የክፍያ ዘዴዎች:\n\n🔹 ቴሌብር - የሞባይል ክፍያ\n🔹 ቻፓ - ዲጂታል ዋሌት\n🔹 ኢብር - ኤሌክትሮኒክ ክፍያ\n🔹 ሲቢኢ ብር - የኢትዮጵያ ንግድ ባንክ\n\nሁሉም ክፍያዎች ደህንነታቸው የተጠበቀ እና በፍጥነት ይሰራሉ!"
                }
            },
            help_info: {
                en: {
                    patterns: ['help', 'support', 'how', 'what', 'guide', 'instructions'],
                    response: "🤝 I can help you with:\n\n🔍 Finding hotels in Ethiopian cities\n📅 Booking rooms and checking availability\n💳 Payment options and methods\n📍 Information about cities and locations\n❓ General travel questions\n\nJust ask me anything or use the menu options below!"
                },
                am: {
                    patterns: ['እርዳታ', 'ድጋፍ', 'እንዴት', 'ምን', 'መመሪያ'],
                    response: "🤝 እኔ በሚከተሉት ልረዳዎት እችላለሁ:\n\n🔍 በኢትዮጵያ ከተሞች ውስጥ ሆቴሎችን ማግኘት\n📅 ክፍሎችን ማስያዝ እና መገኘትን ማረጋገጥ\n💳 የክፍያ አማራጮች እና ዘዴዎች\n📍 ስለ ከተሞች እና ቦታዎች መረጃ\n❓ አጠቃላይ የጉዞ ጥያቄዎች\n\nማንኛውንም ነገር ይጠይቁኝ ወይም ከታች ያሉትን የሜኑ አማራጮች ይጠቀሙ!"
                }
            },
            booking_guide: {
                en: {
                    patterns: ['book', 'booking', 'reserve', 'reservation', 'hotel', 'room'],
                    response: "🏨 Ready to book a hotel? Here's how:\n\n1️⃣ Use '🔍 Search Hotels' to browse options\n2️⃣ Select your preferred city\n3️⃣ Choose dates and number of guests\n4️⃣ Pick your perfect hotel\n5️⃣ Complete payment securely\n\nLet's get started! Use the menu below to search hotels."
                },
                am: {
                    patterns: ['ማስያዝ', 'ሆቴል', 'ክፍል', 'ማስያዝ'],
                    response: "🏨 ሆቴል ለማስያዝ ዝግጁ ነዎት? እንዴት እንደሚሆን ይህ ነው:\n\n1️⃣ አማራጮችን ለማሰስ '🔍 ሆቴሎችን ይፈልጉ' ን ይጠቀሙ\n2️⃣ የሚፈልጉትን ከተማ ይምረጡ\n3️⃣ ቀናት እና የእንግዶች ቁጥር ይምረጡ\n4️⃣ ፍጹም ሆቴልዎን ይምረጡ\n5️⃣ ክፍያን በደህንነት ያጠናቅቁ\n\nእንጀምር! ሆቴሎችን ለመፈለግ ከታች ያለውን ሜኑ ይጠቀሙ።"
                }
            },
            cities_info: {
                en: {
                    patterns: ['addis', 'bahir dar', 'dire dawa', 'gondar', 'mekelle', 'hawassa', 'jimma', 'adama', 'city', 'cities', 'where'],
                    response: "🌍 Popular Ethiopian Cities for Hotels:\n\n🏛️ Addis Ababa - Capital city\n🌊 Bahir Dar - Blue Nile source\n🏰 Gondar - Historical castles\n⛰️ Mekelle - Northern gateway\n🌸 Hawassa - Rift Valley lakes\n☕ Jimma - Coffee region\n🌆 Adama - Industrial hub\n🏜️ Dire Dawa - Eastern commerce\n\nWhich city interests you?"
                },
                am: {
                    patterns: ['አዲስ', 'ባህር ዳር', 'ድሬ ዳዋ', 'ጎንደር', 'መቀሌ', 'ሐዋሳ', 'ጅማ', 'አዳማ', 'ከተማ', 'ከተሞች'],
                    response: "🌍 ለሆቴሎች ታዋቂ የኢትዮጵያ ከተሞች:\n\n🏛️ አዲስ አበባ - ዋና ከተማ\n🌊 ባህር ዳር - የአባይ ምንጭ\n🏰 ጎንደር - ታሪካዊ ቤተ መንግስቶች\n⛰️ መቀሌ - የሰሜን መግቢያ\n🌸 ሐዋሳ - የሪፍት ቫሊ ሀይቆች\n☕ ጅማ - የቡና ክልል\n🌆 አዳማ - የኢንዱስትሪ ማዕከል\n🏜️ ድሬ ዳዋ - የምስራቅ ንግድ\n\nየትኛው ከተማ ይስብዎታል?"
                }
            }
        };

        // Initialize memory cache with common responses
        this.initializeMemoryCache();
    }

    /**
     * Initialize memory cache with predefined responses
     */
    initializeMemoryCache() {
        try {
            for (const [category, languages] of Object.entries(this.commonResponses)) {
                for (const [language, data] of Object.entries(languages)) {
                    for (const pattern of data.patterns) {
                        const cacheKey = this.generateCacheKey(pattern, language);
                        this.memoryCache.set(cacheKey, {
                            response: data.response,
                            category,
                            timestamp: Date.now(),
                            hits: 0
                        });
                    }
                }
            }
            
            logEvent('info', 'Memory cache initialized', {
                context: 'cache_service',
                entries: this.memoryCache.size
            });

        } catch (error) {
            logEvent('error', 'Failed to initialize memory cache', {
                context: 'cache_service',
                error: error.message
            });
        }
    }

    /**
     * Get cached response for a query
     * @param {string} query - User query
     * @param {string} language - User language
     * @returns {Promise<Object|null>} - Cached response or null
     */
    async get(query, language = 'en') {
        try {
            const cacheKey = this.generateCacheKey(query, language);

            // Check memory cache first
            const memoryResult = this.getFromMemory(cacheKey);
            if (memoryResult) {
                this.stats.hits++;
                this.stats.memoryHits++;
                return {
                    response: memoryResult.response,
                    source: 'memory',
                    category: memoryResult.category
                };
            }

            // Check database cache
            const dbResult = await this.getFromDatabase(query, language);
            if (dbResult) {
                this.stats.hits++;
                this.stats.dbHits++;
                
                // Store in memory cache for faster future access
                this.setInMemory(cacheKey, {
                    response: dbResult.response_text,
                    category: dbResult.response_type,
                    timestamp: Date.now(),
                    hits: 1
                });

                return {
                    response: dbResult.response_text,
                    source: 'database',
                    category: dbResult.response_type
                };
            }

            this.stats.misses++;
            return null;

        } catch (error) {
            logEvent('error', 'Cache get operation failed', {
                context: 'cache_service',
                query: query.substring(0, 100),
                language,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Set cached response for a query
     * @param {string} query - User query
     * @param {string} language - User language
     * @param {string} response - Response text
     * @param {string} category - Response category
     * @param {number} ttl - Time to live in seconds (optional)
     */
    async set(query, language, response, category = 'general', ttl = null) {
        try {
            const cacheKey = this.generateCacheKey(query, language);

            // Store in memory cache
            this.setInMemory(cacheKey, {
                response,
                category,
                timestamp: Date.now(),
                hits: 0,
                ttl: ttl ? Date.now() + (ttl * 1000) : null
            });

            // Store in database cache
            await this.setInDatabase(query, language, response, category);

        } catch (error) {
            logEvent('error', 'Cache set operation failed', {
                context: 'cache_service',
                query: query.substring(0, 100),
                language,
                category,
                error: error.message
            });
        }
    }

    /**
     * Get response from memory cache
     * @param {string} cacheKey - Cache key
     * @returns {Object|null} - Cached data or null
     */
    getFromMemory(cacheKey) {
        const cached = this.memoryCache.get(cacheKey);
        
        if (!cached) {
            return null;
        }

        // Check TTL
        if (cached.ttl && Date.now() > cached.ttl) {
            this.memoryCache.delete(cacheKey);
            return null;
        }

        // Check general TTL
        if (Date.now() - cached.timestamp > this.memoryCacheTTL) {
            this.memoryCache.delete(cacheKey);
            return null;
        }

        // Update hit count
        cached.hits++;
        
        return cached;
    }

    /**
     * Set response in memory cache
     * @param {string} cacheKey - Cache key
     * @param {Object} data - Cache data
     */
    setInMemory(cacheKey, data) {
        // Implement LRU eviction if cache is full
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            this.evictLeastRecentlyUsed();
        }

        this.memoryCache.set(cacheKey, data);
    }

    /**
     * Get response from database cache
     * @param {string} query - User query
     * @param {string} language - User language
     * @returns {Promise<Object|null>} - Cached response or null
     */
    async getFromDatabase(query, language) {
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

            // Check if cache entry is still fresh (24 hours for database cache)
            const cacheAge = Date.now() - new Date(data.last_used).getTime();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (cacheAge > maxAge) {
                // Remove stale cache entry
                await supabase.from('query_cache').delete().eq('id', data.id);
                return null;
            }

            // Update last_used timestamp
            await supabase
                .from('query_cache')
                .update({ 
                    last_used: new Date().toISOString(),
                    hit_count: (data.hit_count || 0) + 1
                })
                .eq('id', data.id);

            return data;

        } catch (error) {
            logEvent('error', 'Database cache get failed', {
                context: 'cache_service',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Set response in database cache
     * @param {string} query - User query
     * @param {string} language - User language
     * @param {string} response - Response text
     * @param {string} category - Response category
     */
    async setInDatabase(query, language, response, category) {
        try {
            const queryHash = this.hashQuery(query);

            await supabase.from('query_cache').upsert({
                query_hash: queryHash,
                query_text: query,
                language,
                response_text: response,
                response_type: category,
                last_used: new Date().toISOString(),
                hit_count: 1
            });

        } catch (error) {
            logEvent('error', 'Database cache set failed', {
                context: 'cache_service',
                error: error.message
            });
        }
    }

    /**
     * Evict least recently used items from memory cache
     */
    evictLeastRecentlyUsed() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, data] of this.memoryCache.entries()) {
            if (data.timestamp < oldestTime) {
                oldestTime = data.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.memoryCache.delete(oldestKey);
        }
    }

    /**
     * Generate cache key for query and language
     * @param {string} query - User query
     * @param {string} language - User language
     * @returns {string} - Cache key
     */
    generateCacheKey(query, language) {
        const normalizedQuery = query.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return `${language}:${normalizedQuery}`;
    }

    /**
     * Generate hash for query normalization
     * @param {string} query - User query
     * @returns {string} - Query hash
     */
    hashQuery(query) {
        const normalized = query.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * Clear expired entries from memory cache
     */
    clearExpiredEntries() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, data] of this.memoryCache.entries()) {
            if ((data.ttl && now > data.ttl) || 
                (now - data.timestamp > this.memoryCacheTTL)) {
                keysToDelete.push(key);
            }
        }
        
        // Delete expired keys
        keysToDelete.forEach(key => this.memoryCache.delete(key));
        
        // Force garbage collection if available and memory usage is high
        if (global.gc && this.memoryCache.size > this.maxMemoryCacheSize * 0.8) {
            global.gc();
        }
    }

    /**
     * Aggressive memory cleanup - removes half of the cache when memory is high
     */
    aggressiveMemoryCleanup() {
        if (this.memoryCache.size > this.maxMemoryCacheSize * 0.9) {
            const entries = Array.from(this.memoryCache.entries());
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            // Remove oldest half
            const toRemove = Math.floor(entries.length / 2);
            for (let i = 0; i < toRemove; i++) {
                this.memoryCache.delete(entries[i][0]);
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 ? 
            (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0;

        return {
            ...this.stats,
            hitRate: Math.round(hitRate * 100) / 100,
            memoryCacheSize: this.memoryCache.size,
            maxMemoryCacheSize: this.maxMemoryCacheSize
        };
    }

    /**
     * Clear all caches
     */
    async clearAll() {
        try {
            // Clear memory cache
            this.memoryCache.clear();
            
            // Clear database cache
            await supabase.from('query_cache').delete().neq('id', 0);
            
            // Reset stats
            this.stats = {
                hits: 0,
                misses: 0,
                memoryHits: 0,
                dbHits: 0
            };

            // Reinitialize memory cache
            this.initializeMemoryCache();

            logEvent('info', 'All caches cleared', {
                context: 'cache_service'
            });

        } catch (error) {
            logEvent('error', 'Failed to clear caches', {
                context: 'cache_service',
                error: error.message
            });
        }
    }

    /**
     * Warm up cache with common queries
     */
    async warmUp() {
        try {
            const commonQueries = [
                { query: 'hello', language: 'en' },
                { query: 'hi', language: 'en' },
                { query: 'help', language: 'en' },
                { query: 'payment', language: 'en' },
                { query: 'book hotel', language: 'en' },
                { query: 'ሰላም', language: 'am' },
                { query: 'እርዳታ', language: 'am' },
                { query: 'ክፍያ', language: 'am' },
                { query: 'ሆቴል ማስያዝ', language: 'am' }
            ];

            for (const { query, language } of commonQueries) {
                await this.get(query, language);
            }

            logEvent('info', 'Cache warm-up completed', {
                context: 'cache_service',
                queries: commonQueries.length
            });

        } catch (error) {
            logEvent('error', 'Cache warm-up failed', {
                context: 'cache_service',
                error: error.message
            });
        }
    }
}

// Create singleton instance
const cacheService = new CacheService();

// Periodic cleanup of expired entries (more frequent for memory optimization)
setInterval(() => {
    cacheService.clearExpiredEntries();
}, 2 * 60 * 1000); // Every 2 minutes (reduced from 5 minutes)

// Aggressive memory cleanup every 10 minutes
setInterval(() => {
    cacheService.aggressiveMemoryCleanup();
}, 10 * 60 * 1000); // Every 10 minutes

export default cacheService;