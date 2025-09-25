import resilienceService from './resilienceService.js';
import puterAIService from './puterAIService.js';
import { logEvent } from './logService.js';

/**
 * AI Provider Manager - Handles multiple AI providers with fallback logic
 * Provides resilient AI services with automatic failover between providers
 */
class AIProviderManager {
    constructor() {
        this.providers = {
            openai: {
                name: 'OpenAI',
                priority: 1,
                service: null, // Will be injected
                circuitBreakerKey: 'openai_chat',
                capabilities: ['chat', 'embeddings', 'image_analysis'],
                costModel: 'paid'
            },
            puter: {
                name: 'Puter.js (Gemini)',
                priority: 2,
                service: puterAIService,
                circuitBreakerKey: 'puter_ai',
                capabilities: ['chat', 'image_analysis'],
                costModel: 'free'
            }
        };

        this.defaultProvider = 'openai';
        this.fallbackEnabled = true;
        this.userPreferences = new Map(); // Store user provider preferences

        logEvent('info', 'AI Provider Manager initialized', {
            context: 'ai_provider_manager',
            providers: Object.keys(this.providers),
            default_provider: this.defaultProvider,
            fallback_enabled: this.fallbackEnabled
        });
    }

    /**
     * Set the OpenAI service instance
     * @param {Object} openaiService - The OpenAI service instance
     */
    setOpenAIService(openaiService) {
        this.providers.openai.service = openaiService;
        logEvent('info', 'OpenAI service registered with provider manager', {
            context: 'ai_provider_manager'
        });
    }

    /**
     * Generate a chat response with automatic fallback
     * @param {string} prompt - The user's prompt
     * @param {string} language - Language code
     * @param {string} userId - User ID for preferences
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Response with provider info
     */
    async generateResponse(prompt, language = 'en', userId = null, options = {}) {
        const startTime = Date.now();
        const userPreference = this.getUserPreference(userId);
        
        // Determine provider order based on user preference
        const providerOrder = this.getProviderOrder(userPreference, 'chat');

        logEvent('info', 'Generating AI response with fallback', {
            context: 'ai_provider_manager',
            user_id: userId,
            prompt_length: prompt.length,
            language,
            provider_order: providerOrder.map(p => p.name),
            user_preference: userPreference
        });

        let lastError = null;
        let attemptedProviders = [];

        for (const provider of providerOrder) {
            try {
                attemptedProviders.push(provider.name);
                
                logEvent('info', `Attempting response with ${provider.name}`, {
                    context: 'ai_provider_manager',
                    provider: provider.name,
                    circuit_breaker_key: provider.circuitBreakerKey
                });

                // Use circuit breaker for resilience
                const response = await resilienceService.withCircuitBreaker(
                    provider.circuitBreakerKey,
                    async () => {
                        return await this.callProvider(provider, 'generateResponse', [prompt, {
                            ...options,
                            language,
                            context: options.context
                        }]);
                    }
                );

                const responseTime = Date.now() - startTime;

                logEvent('info', `AI response generated successfully with ${provider.name}`, {
                    context: 'ai_provider_manager',
                    provider: provider.name,
                    response_length: response.length,
                    response_time_ms: responseTime,
                    attempted_providers: attemptedProviders,
                    cost_model: provider.costModel
                });

                return {
                    response,
                    provider: provider.name,
                    costModel: provider.costModel,
                    responseTime: responseTime,
                    attemptedProviders,
                    fallbackUsed: attemptedProviders.length > 1
                };

            } catch (error) {
                lastError = error;
                
                logEvent('warn', `${provider.name} failed, trying next provider`, {
                    context: 'ai_provider_manager',
                    provider: provider.name,
                    error: error.message,
                    attempted_providers: attemptedProviders
                });

                // Continue to next provider if fallback is enabled
                if (!this.fallbackEnabled) {
                    break;
                }
            }
        }

        // All providers failed
        const responseTime = Date.now() - startTime;
        
        logEvent('error', 'All AI providers failed', {
            context: 'ai_provider_manager',
            attempted_providers: attemptedProviders,
            last_error: lastError?.message,
            response_time_ms: responseTime
        });

        throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Generate embeddings with fallback (primarily OpenAI)
     * @param {string} text - Text to embed
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Embeddings with provider info
     */
    async generateEmbeddings(text, options = {}) {
        const startTime = Date.now();

        // Embeddings are primarily handled by OpenAI
        const provider = this.providers.openai;
        
        if (!provider.service) {
            throw new Error('OpenAI service not available for embeddings');
        }

        try {
            logEvent('info', 'Generating embeddings with OpenAI', {
                context: 'ai_provider_manager',
                text_length: text.length,
                provider: provider.name
            });

            const embeddings = await resilienceService.withCircuitBreaker(
                'openai_embeddings',
                async () => {
                    // Assuming OpenAI service has generateEmbedding method
                    return await provider.service.generateEmbedding(text, options);
                }
            );

            const responseTime = Date.now() - startTime;

            logEvent('info', 'Embeddings generated successfully', {
                context: 'ai_provider_manager',
                provider: provider.name,
                response_time_ms: responseTime,
                embedding_dimensions: embeddings?.length || 'unknown'
            });

            return {
                embeddings,
                provider: provider.name,
                responseTime: responseTime
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            logEvent('error', 'Embeddings generation failed', {
                context: 'ai_provider_manager',
                provider: provider.name,
                error: error.message,
                response_time_ms: responseTime
            });

            throw new Error(`Embeddings generation failed: ${error.message}`);
        }
    }

    /**
     * Analyze image with fallback between providers
     * @param {string} prompt - Prompt about the image
     * @param {string} imageUrl - Image URL
     * @param {string} userId - User ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Analysis with provider info
     */
    async analyzeImage(prompt, imageUrl, userId = null, options = {}) {
        const startTime = Date.now();
        const userPreference = this.getUserPreference(userId);
        
        // Get providers that support image analysis
        const providerOrder = this.getProviderOrder(userPreference, 'image_analysis');

        logEvent('info', 'Analyzing image with fallback', {
            context: 'ai_provider_manager',
            user_id: userId,
            prompt_length: prompt.length,
            image_url: imageUrl,
            provider_order: providerOrder.map(p => p.name)
        });

        let lastError = null;
        let attemptedProviders = [];

        for (const provider of providerOrder) {
            try {
                attemptedProviders.push(provider.name);
                
                const analysis = await resilienceService.withCircuitBreaker(
                    provider.circuitBreakerKey,
                    async () => {
                        return await this.callProvider(provider, 'analyzeImage', [prompt, imageUrl, options]);
                    }
                );

                const responseTime = Date.now() - startTime;

                logEvent('info', `Image analysis completed with ${provider.name}`, {
                    context: 'ai_provider_manager',
                    provider: provider.name,
                    response_length: analysis.length,
                    response_time_ms: responseTime,
                    attempted_providers: attemptedProviders
                });

                return {
                    analysis,
                    provider: provider.name,
                    costModel: provider.costModel,
                    responseTime: responseTime,
                    attemptedProviders,
                    fallbackUsed: attemptedProviders.length > 1
                };

            } catch (error) {
                lastError = error;
                
                logEvent('warn', `${provider.name} image analysis failed, trying next provider`, {
                    context: 'ai_provider_manager',
                    provider: provider.name,
                    error: error.message
                });

                if (!this.fallbackEnabled) {
                    break;
                }
            }
        }

        const responseTime = Date.now() - startTime;
        
        logEvent('error', 'All providers failed for image analysis', {
            context: 'ai_provider_manager',
            attempted_providers: attemptedProviders,
            last_error: lastError?.message,
            response_time_ms: responseTime
        });

        throw new Error(`Image analysis failed with all providers. Last error: ${lastError?.message}`);
    }

    /**
     * Set user provider preference
     * @param {string} userId - User ID
     * @param {string} provider - Preferred provider
     */
    setUserPreference(userId, provider) {
        if (this.providers[provider]) {
            this.userPreferences.set(userId, provider);
            
            logEvent('info', 'User provider preference updated', {
                context: 'ai_provider_manager',
                user_id: userId,
                preferred_provider: provider
            });
        } else {
            throw new Error(`Invalid provider: ${provider}`);
        }
    }

    /**
     * Get user provider preference
     * @param {string} userId - User ID
     * @returns {string} - Preferred provider or default
     */
    getUserPreference(userId) {
        return userId ? this.userPreferences.get(userId) || this.defaultProvider : this.defaultProvider;
    }

    /**
     * Get provider order based on preference and capability
     * @param {string} userPreference - User's preferred provider
     * @param {string} capability - Required capability
     * @returns {Array} - Ordered list of providers
     */
    getProviderOrder(userPreference, capability) {
        const availableProviders = Object.values(this.providers)
            .filter(p => p.service && p.capabilities.includes(capability))
            .sort((a, b) => a.priority - b.priority);

        // If user has preference and it's available, put it first
        if (userPreference && this.providers[userPreference] && 
            this.providers[userPreference].capabilities.includes(capability)) {
            
            const preferred = this.providers[userPreference];
            const others = availableProviders.filter(p => p.name !== preferred.name);
            return [preferred, ...others];
        }

        return availableProviders;
    }

    /**
     * Call a method on a provider service
     * @param {Object} provider - Provider configuration
     * @param {string} method - Method name
     * @param {Array} args - Method arguments
     * @returns {Promise<any>} - Method result
     */
    async callProvider(provider, method, args) {
        if (!provider.service) {
            throw new Error(`${provider.name} service not available`);
        }

        if (typeof provider.service[method] !== 'function') {
            throw new Error(`${provider.name} does not support method: ${method}`);
        }

        return await provider.service[method](...args);
    }

    /**
     * Get provider status and health information
     * @returns {Promise<Object>} - Provider status
     */
    async getProviderStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            defaultProvider: this.defaultProvider,
            fallbackEnabled: this.fallbackEnabled,
            providers: {}
        };

        for (const [key, provider] of Object.entries(this.providers)) {
            try {
                const health = provider.service && typeof provider.service.getHealthStatus === 'function'
                    ? await provider.service.getHealthStatus()
                    : { status: 'unknown', service: provider.name };

                status.providers[key] = {
                    name: provider.name,
                    priority: provider.priority,
                    capabilities: provider.capabilities,
                    costModel: provider.costModel,
                    available: !!provider.service,
                    health: health
                };
            } catch (error) {
                status.providers[key] = {
                    name: provider.name,
                    priority: provider.priority,
                    capabilities: provider.capabilities,
                    costModel: provider.costModel,
                    available: false,
                    health: { status: 'error', error: error.message }
                };
            }
        }

        return status;
    }

    /**
     * Enable or disable fallback functionality
     * @param {boolean} enabled - Whether fallback is enabled
     */
    setFallbackEnabled(enabled) {
        this.fallbackEnabled = enabled;
        
        logEvent('info', 'Fallback functionality updated', {
            context: 'ai_provider_manager',
            fallback_enabled: enabled
        });
    }

    /**
     * Get available providers for a capability
     * @param {string} capability - Required capability
     * @returns {Array} - Available providers
     */
    getAvailableProviders(capability) {
        return Object.entries(this.providers)
            .filter(([key, provider]) => provider.service && provider.capabilities.includes(capability))
            .map(([key, provider]) => ({
                key,
                name: provider.name,
                costModel: provider.costModel,
                priority: provider.priority
            }));
    }
}

// Export singleton instance
export default new AIProviderManager();