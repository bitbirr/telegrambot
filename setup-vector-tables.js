import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function setupVectorTables() {
  console.log('🚀 Setting up vector tables...');
  
  try {
    // Test if we can create the query_cache table
    console.log('📝 Creating query_cache table...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('query_cache')
      .select('*')
      .limit(1);
    
    if (cacheError && cacheError.code === 'PGRST116') {
      console.log('⚠️  query_cache table does not exist');
    } else {
      console.log('✅ query_cache table exists');
    }
    
    // Test if we can create the ai_usage_analytics table
    console.log('📊 Creating ai_usage_analytics table...');
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('ai_usage_analytics')
      .select('*')
      .limit(1);
    
    if (analyticsError && analyticsError.code === 'PGRST116') {
      console.log('⚠️  ai_usage_analytics table does not exist');
    } else {
      console.log('✅ ai_usage_analytics table exists');
    }
    
    // Test if we can create the knowledge_base_embeddings table
    console.log('🧠 Creating knowledge_base_embeddings table...');
    const { data: kbEmbedData, error: kbEmbedError } = await supabase
      .from('knowledge_base_embeddings')
      .select('*')
      .limit(1);
    
    if (kbEmbedError && kbEmbedError.code === 'PGRST116') {
      console.log('⚠️  knowledge_base_embeddings table does not exist');
    } else {
      console.log('✅ knowledge_base_embeddings table exists');
    }
    
    // Test if we can create the hotel_embeddings table
    console.log('🏨 Creating hotel_embeddings table...');
    const { data: hotelEmbedData, error: hotelEmbedError } = await supabase
      .from('hotel_embeddings')
      .select('*')
      .limit(1);
    
    if (hotelEmbedError && hotelEmbedError.code === 'PGRST116') {
      console.log('⚠️  hotel_embeddings table does not exist');
    } else {
      console.log('✅ hotel_embeddings table exists');
    }
    
    console.log('\n📋 Summary:');
    console.log('The vector tables need to be created manually in Supabase dashboard.');
    console.log('Please run the setup-pgvector.sql script in your Supabase SQL editor.');
    console.log('\n🔧 For now, the system will work with fallback responses and basic caching.');
    
  } catch (error) {
    console.error('❌ Error setting up vector tables:', error);
  }
}

setupVectorTables();