import axios from 'axios';
import { logEvent } from './logService.js';

/**
 * PuterAIService - Integrates with Gemini models via Puter.js
 * Provides free access to Google's Gemini models without API keys
 */
class PuterAIService {
    constructor() {
        this.baseURL = 'https://api.puter.com/v1';
        this.defaultModel = 'google/gemini-2.0-flash-lite-001';
        this.availableModels = [
            'google/gemini-2.0-flash-001',
            'google/gemini-2.0-flash-exp:free',
            'google/gemini-2.5-flash-image-preview:free',
        ];
        
        logEvent('info', 'PuterAIService initialized', {
            context: 'puter_ai_service',
            default_model: this.defaultModel,
            available_models_count: this.availableModels.length
        });
    }

    /**
     * Generate a chat response using Gemini models via Puter.js
     * @param {string} prompt - The user's prompt
     * @param {Object} options - Configuration options
     * @returns {Promise<string>} - The AI response
     */
    async generateResponse(prompt, options = {}) {
        const startTime = Date.now();
        
        try {
            const {
                model = this.defaultModel,
                maxTokens = 1000,
                temperature = 0.7,
                stream = false,
                context = null
            } = options;

            logEvent('info', 'Generating response with Puter.js', {
                context: 'puter_ai_service',
                model,
                prompt_length: prompt.length,
                stream,
                max_tokens: maxTokens
            });

            // Prepare the request payload
            const payload = {
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: model,
                max_tokens: maxTokens,
                temperature: temperature,
                stream: stream
            };

            // Add context if provided
            if (context) {
                payload.messages.unshift({
                    role: 'system',
                    content: context
                });
            }

            // Make the API request
            const response = await axios.post(`${this.baseURL}/ai/chat`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'eQabo-TelegramBot/1.0.0'
                },
                timeout: 30000 // 30 second timeout
            });

            const responseTime = Date.now() - startTime;

            if (response.data && response.data.choices && response.data.choices[0]) {
                const aiResponse = response.data.choices[0].message.content;
                
                logEvent('info', 'Puter.js response generated successfully', {
                    context: 'puter_ai_service',
                    model,
                    response_length: aiResponse.length,
                    response_time_ms: responseTime,
                    tokens_used: response.data.usage?.total_tokens || 'unknown'
                });

                return aiResponse;
            } else {
                throw new Error('Invalid response format from Puter.js API');
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            logEvent('error', 'Puter.js API request failed', {
                context: 'puter_ai_service',
                error: error.message,
                response_time_ms: responseTime,
                status_code: error.response?.status,
                error_details: error.response?.data
            });

            // Re-throw with more context
            throw new Error(`Puter.js API Error: ${error.message}`);
        }
    }

    /**
     * Generate a streaming response using Gemini models
     * @param {string} prompt - The user's prompt
     * @param {Object} options - Configuration options
     * @returns {AsyncGenerator<string>} - Streaming response
     */
    async* generateStreamingResponse(prompt, options = {}) {
        const {
            model = this.defaultModel,
            maxTokens = 1000,
            temperature = 0.7,
            context = null
        } = options;

        try {
            logEvent('info', 'Starting streaming response with Puter.js', {
                context: 'puter_ai_service',
                model,
                prompt_length: prompt.length
            });

            // Prepare the request payload
            const payload = {
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: model,
                max_tokens: maxTokens,
                temperature: temperature,
                stream: true
            };

            // Add context if provided
            if (context) {
                payload.messages.unshift({
                    role: 'system',
                    content: context
                });
            }

            // Make the streaming API request
            const response = await axios.post(`${this.baseURL}/ai/chat`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'eQabo-TelegramBot/1.0.0'
                },
                responseType: 'stream',
                timeout: 60000 // 60 second timeout for streaming
            });

            let buffer = '';
            
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                                const content = parsed.choices[0].delta.content;
                                if (content) {
                                    yield content;
                                }
                            }
                        } catch (parseError) {
                            // Skip invalid JSON chunks
                            continue;
                        }
                    }
                }
            }

        } catch (error) {
            logEvent('error', 'Puter.js streaming request failed', {
                context: 'puter_ai_service',
                error: error.message,
                status_code: error.response?.status
            });

            throw new Error(`Puter.js Streaming Error: ${error.message}`);
        }
    }

    /**
     * Analyze an image using Gemini's vision capabilities
     * @param {string} prompt - The prompt about the image
     * @param {string} imageUrl - URL of the image to analyze
     * @param {Object} options - Configuration options
     * @returns {Promise<string>} - The analysis result
     */
    async analyzeImage(prompt, imageUrl, options = {}) {
        const startTime = Date.now();
        
        try {
            const {
                model = 'google/gemini-2.5-flash-image-preview',
                maxTokens = 1000,
                temperature = 0.7
            } = options;

            logEvent('info', 'Analyzing image with Puter.js', {
                context: 'puter_ai_service',
                model,
                prompt_length: prompt.length,
                image_url: imageUrl
            });

            const payload = {
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageUrl
                                }
                            }
                        ]
                    }
                ],
                model: model,
                max_tokens: maxTokens,
                temperature: temperature
            };

            const response = await axios.post(`${this.baseURL}/ai/chat`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'eQabo-TelegramBot/1.0.0'
                },
                timeout: 45000 // 45 second timeout for image analysis
            });

            const responseTime = Date.now() - startTime;

            if (response.data && response.data.choices && response.data.choices[0]) {
                const analysis = response.data.choices[0].message.content;
                
                logEvent('info', 'Image analysis completed successfully', {
                    context: 'puter_ai_service',
                    model,
                    response_length: analysis.length,
                    response_time_ms: responseTime
                });

                return analysis;
            } else {
                throw new Error('Invalid response format from Puter.js image analysis');
            }

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            logEvent('error', 'Puter.js image analysis failed', {
                context: 'puter_ai_service',
                error: error.message,
                response_time_ms: responseTime,
                status_code: error.response?.status
            });

            throw new Error(`Puter.js Image Analysis Error: ${error.message}`);
        }
    }

    /**
     * Get available models
     * @returns {Array<string>} - List of available models
     */
    getAvailableModels() {
        return [...this.availableModels];
    }

    /**
     * Check if a model is available
     * @param {string} model - Model name to check
     * @returns {boolean} - Whether the model is available
     */
    isModelAvailable(model) {
        return this.availableModels.includes(model);
    }

    /**
     * Get service health status
     * @returns {Promise<Object>} - Health status
     */
    async getHealthStatus() {
        try {
            // Simple health check by making a minimal request
            const response = await axios.get(`${this.baseURL}/health`, {
                timeout: 5000
            });

            return {
                status: 'healthy',
                service: 'puter_ai',
                response_time: response.headers['x-response-time'] || 'unknown',
                available_models: this.availableModels.length
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                service: 'puter_ai',
                error: error.message,
                available_models: this.availableModels.length
            };
        }
    }
}

// Export singleton instance
export default new PuterAIService();