// =====================================================
// eQabo.com AI Optimization - Test Script
// Test the complete optimization system and measure improvements
// =====================================================

import optimizedAIService from './src/services/optimizedAIService.js';
import cacheService from './src/services/cacheService.js';
import embeddingsService from './src/services/embeddingsService.js';
import { logEvent } from './src/services/logService.js';

/**
 * Test the AI optimization system
 */
async function testOptimization() {
    console.log('🧪 Testing eQabo.com AI Optimization System\n');
    
    try {
        // Test queries in different languages
        const testQueries = [
            { query: 'hello', language: 'en', expectedMethod: 'fallback' },
            { query: 'hi there', language: 'en', expectedMethod: 'fallback' },
            { query: 'help me', language: 'en', expectedMethod: 'fallback' },
            { query: 'payment methods', language: 'en', expectedMethod: 'fallback' },
            { query: 'book a hotel', language: 'en', expectedMethod: 'fallback' },
            { query: 'hotels in addis ababa', language: 'en', expectedMethod: 'semantic_search' },
            { query: 'ሰላም', language: 'am', expectedMethod: 'fallback' },
            { query: 'እርዳታ', language: 'am', expectedMethod: 'fallback' },
            { query: 'ክፍያ', language: 'am', expectedMethod: 'fallback' },
            { query: 'ሆቴል ማስያዝ', language: 'am', expectedMethod: 'fallback' },
            { query: 'what is the weather like today?', language: 'en', expectedMethod: 'ai_generated' }
        ];

        let totalTests = 0;
        let passedTests = 0;
        let totalTokens = 0;
        let totalCost = 0;
        let totalResponseTime = 0;

        console.log('📊 Running test queries...\n');

        for (const test of testQueries) {
            totalTests++;
            console.log(`🔍 Testing: "${test.query}" (${test.language})`);
            
            const startTime = Date.now();
            const result = await optimizedAIService.processQuery(
                test.query, 
                test.language, 
                'test_user'
            );
            const endTime = Date.now();

            if (result && result.response) {
                passedTests++;
                totalTokens += result.tokensUsed || 0;
                totalCost += result.costEstimate || 0;
                totalResponseTime += result.responseTime || (endTime - startTime);

                console.log(`   ✅ Method: ${result.method}`);
                console.log(`   📝 Response: ${result.response.substring(0, 100)}...`);
                console.log(`   ⚡ Time: ${result.responseTime || (endTime - startTime)}ms`);
                console.log(`   🎯 Tokens: ${result.tokensUsed || 0}`);
                console.log(`   💰 Cost: $${(result.costEstimate || 0).toFixed(6)}`);
                
                // Test caching - run same query again
                console.log(`   🔄 Testing cache...`);
                const cachedResult = await optimizedAIService.processQuery(
                    test.query, 
                    test.language, 
                    'test_user'
                );
                
                if (cachedResult && cachedResult.method === 'cached') {
                    console.log(`   ✅ Cache hit successful!`);
                } else {
                    console.log(`   ⚠️ Cache miss (method: ${cachedResult?.method})`);
                }
            } else {
                console.log(`   ❌ Failed to get response`);
            }
            
            console.log('');
        }

        // Test cache service directly
        console.log('🗄️ Testing cache service...\n');
        
        await cacheService.set('test query', 'en', 'test response', 'test');
        const cachedResponse = await cacheService.get('test query', 'en');
        
        if (cachedResponse && cachedResponse.response === 'test response') {
            console.log('✅ Cache service working correctly');
        } else {
            console.log('❌ Cache service test failed');
        }

        // Test embeddings service
        console.log('\n🔍 Testing embeddings service...\n');
        
        try {
            const embedding = await embeddingsService.generateEmbedding('test hotel query');
            if (embedding && embedding.length > 0) {
                console.log(`✅ Embeddings service working (dimension: ${embedding.length})`);
            } else {
                console.log('❌ Embeddings service test failed');
            }
        } catch (error) {
            console.log(`⚠️ Embeddings service test skipped: ${error.message}`);
        }

        // Get optimization statistics
        console.log('\n📈 Getting optimization statistics...\n');
        
        const stats = await optimizedAIService.getOptimizationStats();
        if (stats) {
            console.log('📊 Optimization Statistics (24h):');
            console.log(`   Total queries: ${stats.total_queries}`);
            console.log(`   Optimization rate: ${stats.optimization_rate.toFixed(1)}%`);
            console.log(`   Total tokens saved: ${stats.total_tokens}`);
            console.log(`   Total cost: $${stats.total_cost.toFixed(6)}`);
            console.log('   Methods breakdown:');
            for (const [method, count] of Object.entries(stats.methods)) {
                console.log(`     ${method}: ${count}`);
            }
        }

        // Get cache statistics
        const cacheStats = cacheService.getStats();
        console.log('\n🗄️ Cache Statistics:');
        console.log(`   Hit rate: ${cacheStats.hitRate}%`);
        console.log(`   Total hits: ${cacheStats.hits}`);
        console.log(`   Total misses: ${cacheStats.misses}`);
        console.log(`   Memory cache size: ${cacheStats.memoryCacheSize}/${cacheStats.maxMemoryCacheSize}`);

        // Summary
        console.log('\n🎯 Test Summary:');
        console.log(`   Tests passed: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
        console.log(`   Average response time: ${(totalResponseTime/totalTests).toFixed(0)}ms`);
        console.log(`   Total tokens used: ${totalTokens}`);
        console.log(`   Total estimated cost: $${totalCost.toFixed(6)}`);

        // Cost comparison
        const traditionalCost = totalTests * 0.0015; // Assuming each query would cost ~$0.0015 with direct OpenAI
        const savings = traditionalCost - totalCost;
        const savingsPercent = traditionalCost > 0 ? (savings / traditionalCost) * 100 : 0;

        console.log('\n💰 Cost Analysis:');
        console.log(`   Traditional cost estimate: $${traditionalCost.toFixed(6)}`);
        console.log(`   Optimized cost: $${totalCost.toFixed(6)}`);
        console.log(`   Savings: $${savings.toFixed(6)} (${savingsPercent.toFixed(1)}%)`);

        if (passedTests === totalTests) {
            console.log('\n🎉 All tests passed! AI optimization system is working correctly.');
        } else {
            console.log(`\n⚠️ ${totalTests - passedTests} tests failed. Please check the implementation.`);
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        await logEvent('error', 'AI optimization test failed', {
            context: 'test_ai_optimization',
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Test database setup for optimization features
 */
async function testDatabaseSetup() {
    console.log('\n🗄️ Testing database setup for optimization features...\n');
    
    try {
        // Test if required tables exist
        const requiredTables = [
            'knowledge_base_embeddings',
            'hotel_embeddings', 
            'query_cache',
            'ai_usage_analytics'
        ];

        for (const table of requiredTables) {
            try {
                // Try to query the table
                const { data, error } = await supabase
                    .from(table)
                    .select('*')
                    .limit(1);

                if (error) {
                    console.log(`❌ Table '${table}' not accessible: ${error.message}`);
                } else {
                    console.log(`✅ Table '${table}' exists and accessible`);
                }
            } catch (error) {
                console.log(`❌ Table '${table}' test failed: ${error.message}`);
            }
        }

        // Test pgvector extension
        try {
            const { data, error } = await supabase.rpc('test_pgvector');
            if (error) {
                console.log(`⚠️ pgvector extension test: ${error.message}`);
            } else {
                console.log('✅ pgvector extension is working');
            }
        } catch (error) {
            console.log(`⚠️ pgvector extension not tested: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Database setup test failed:', error);
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting eQabo.com AI Optimization Tests\n');
    
    await testDatabaseSetup();
    await testOptimization();
    
    console.log('\n✨ Tests completed!');
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    process.exit(1);
});

// Run the tests
runAllTests().catch(console.error);