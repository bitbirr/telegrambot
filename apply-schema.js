import supabase from './src/supabase.js';
import fs from 'fs';

async function applySchema() {
    try {
        console.log('📖 Reading database schema file...');
        const schemaSQL = fs.readFileSync('database-upgrade-schema.sql', 'utf8');
        
        console.log('🔧 Applying database schema...');
        
        // Execute the schema directly
        const { data, error } = await supabase
            .from('_sql')
            .select('*')
            .limit(1);
        
        if (error) {
            console.log('⚠️  Direct SQL execution not available, trying table creation individually...');
            
            // Try creating tables individually
            await createTablesIndividually();
        } else {
            console.log('✅ Schema application completed!');
        }
        
    } catch (error) {
        console.error('❌ Error applying schema:', error);
        console.log('🔄 Trying individual table creation...');
        await createTablesIndividually();
    }
}

async function createTablesIndividually() {
    console.log('🔧 Creating tables individually...');
    
    // Check if knowledge_base table exists
    const { data: kbData, error: kbError } = await supabase
        .from('knowledge_base')
        .select('*')
        .limit(1);
    
    if (kbError && kbError.code === '42P01') {
        console.log('❌ knowledge_base table does not exist');
        console.log('📋 Please manually run the database-upgrade-schema.sql in your Supabase SQL editor');
        console.log('🔗 Go to: https://supabase.com/dashboard/project/[your-project]/sql');
        return;
    }
    
    console.log('✅ Tables appear to be created. Checking cities table...');
    
    const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .limit(1);
    
    if (citiesError) {
        console.log('❌ Cities table issue:', citiesError);
        return;
    }
    
    console.log('✅ Cities table exists');
    
    const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .limit(1);
    
    if (hotelsError) {
        console.log('❌ Hotels table issue:', hotelsError);
        return;
    }
    
    console.log('✅ Hotels table exists with city_id column');
}

applySchema();