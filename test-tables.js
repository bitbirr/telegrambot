import supabase from './src/supabase.js';

async function testTables() {
    console.log('🔍 Testing database tables...');
    
    try {
        // Test cities table
        console.log('📍 Testing cities table...');
        const { data: cities, error: citiesError } = await supabase
            .from('cities')
            .select('id, key, names')
            .limit(1);
        
        if (citiesError) {
            console.log('❌ Cities table error:', citiesError);
        } else {
            console.log('✅ Cities table works:', cities?.length || 0, 'records');
        }
        
        // Test hotels table structure by trying to insert a test record
        console.log('🏨 Testing hotels table structure...');
        
        // First, let's try to get the table structure
        const { data: hotelsStructure, error: structureError } = await supabase
            .rpc('get_table_columns', { table_name: 'hotels' });
        
        if (structureError) {
            console.log('⚠️  Cannot get table structure, trying direct query...');
            
            // Try a simple select to see if table exists
            const { data: hotels, error: hotelsError } = await supabase
                .from('hotels')
                .select('*')
                .limit(0); // Just check structure, don't get data
            
            if (hotelsError) {
                console.log('❌ Hotels table error:', hotelsError);
                
                if (hotelsError.code === '42P01') {
                    console.log('🚨 Hotels table does not exist!');
                } else if (hotelsError.code === '42703') {
                    console.log('🚨 Column missing in hotels table!');
                }
            } else {
                console.log('✅ Hotels table exists and is accessible');
            }
        } else {
            console.log('✅ Hotels table structure:', hotelsStructure);
        }
        
        // Test payment_methods table
        console.log('💳 Testing payment_methods table...');
        const { data: payments, error: paymentsError } = await supabase
            .from('payment_methods')
            .select('id, key, translations')
            .limit(1);
        
        if (paymentsError) {
            console.log('❌ Payment methods table error:', paymentsError);
        } else {
            console.log('✅ Payment methods table works:', payments?.length || 0, 'records');
        }
        
        // Test knowledge_base table
        console.log('📚 Testing knowledge_base table...');
        const { data: kb, error: kbError } = await supabase
            .from('knowledge_base')
            .select('id, key, language, message')
            .limit(1);
        
        if (kbError) {
            console.log('❌ Knowledge base table error:', kbError);
        } else {
            console.log('✅ Knowledge base table works:', kb?.length || 0, 'records');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testTables();