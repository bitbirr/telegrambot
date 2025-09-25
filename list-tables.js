import supabase from './src/supabase.js';

async function listTables() {
    console.log('📋 Listing all available tables...');
    
    try {
        // Try to get table information using a PostgreSQL system query
        const { data, error } = await supabase
            .rpc('get_schema_tables');
        
        if (error) {
            console.log('⚠️  Cannot use RPC, trying alternative method...');
            
            // Try different table names that might exist
            const tablesToTest = [
                'cities',
                'hotels', 
                'payment_methods',
                'payment_methods_bot',
                'knowledge_base',
                'ai_feedback',
                'ai_escalations',
                'bot_logs',
                'user_sessions',
                'bookings'
            ];
            
            console.log('🔍 Testing known table names...');
            
            for (const tableName of tablesToTest) {
                try {
                    const { data, error } = await supabase
                        .from(tableName)
                        .select('*')
                        .limit(0);
                    
                    if (!error) {
                        console.log(`✅ Table exists: ${tableName}`);
                    }
                } catch (err) {
                    // Table doesn't exist or has issues
                    if (err.code === '42P01') {
                        console.log(`❌ Table missing: ${tableName}`);
                    } else {
                        console.log(`⚠️  Table issue: ${tableName} - ${err.message}`);
                    }
                }
            }
        } else {
            console.log('✅ Available tables:', data);
        }
        
    } catch (error) {
        console.error('❌ Error listing tables:', error);
    }
}

listTables();