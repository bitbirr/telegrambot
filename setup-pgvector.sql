-- =====================================================
-- eQabo.com AI Optimization - pgvector Setup
-- Enable semantic search with embeddings
-- =====================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- KNOWLEDGE BASE EMBEDDINGS TABLE
-- Store embeddings for FAQ and knowledge base content
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_base_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for change detection
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(knowledge_base_id)
);

-- Create index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embeddings_vector 
ON knowledge_base_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- =====================================================
-- HOTEL EMBEDDINGS TABLE
-- Store embeddings for hotel descriptions and amenities
-- =====================================================
CREATE TABLE IF NOT EXISTS hotel_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for change detection
    searchable_content TEXT NOT NULL, -- Combined hotel info for embedding
    language VARCHAR(5) NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(hotel_id, language)
);

-- Create index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_hotel_embeddings_vector 
ON hotel_embeddings USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_hotel_embeddings_language ON hotel_embeddings(language);

-- =====================================================
-- QUERY CACHE TABLE
-- Cache frequent queries and responses to avoid AI calls
-- =====================================================
CREATE TABLE IF NOT EXISTS query_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of normalized query
    query_text TEXT NOT NULL,
    language VARCHAR(5) NOT NULL,
    response_text TEXT NOT NULL,
    response_type VARCHAR(50) NOT NULL, -- 'cached', 'knowledge_base', 'semantic_search', 'ai_generated'
    hit_count INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(query_hash, language)
);

CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON query_cache(query_hash, language);
CREATE INDEX IF NOT EXISTS idx_query_cache_last_used ON query_cache(last_used);
CREATE INDEX IF NOT EXISTS idx_query_cache_hit_count ON query_cache(hit_count);

-- =====================================================
-- AI USAGE ANALYTICS TABLE
-- Track AI usage patterns and costs for optimization
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    query_text TEXT NOT NULL,
    language VARCHAR(5) NOT NULL,
    resolution_method VARCHAR(50) NOT NULL, -- 'cached', 'knowledge_base', 'semantic_search', 'ai_generated', 'fallback'
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    cost_estimate DECIMAL(10,6) DEFAULT 0, -- Estimated cost in USD
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_method ON ai_usage_analytics(resolution_method);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_analytics(created_at);

-- =====================================================
-- FUNCTIONS FOR SEMANTIC SEARCH
-- =====================================================

-- Function to search knowledge base using semantic similarity
CREATE OR REPLACE FUNCTION search_knowledge_base_semantic(
    query_embedding vector(1536),
    target_language VARCHAR(5) DEFAULT 'en',
    similarity_threshold FLOAT DEFAULT 0.8,
    max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    key VARCHAR(100),
    message TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.key,
        kb.message,
        (1 - (kbe.embedding <=> query_embedding)) as similarity
    FROM knowledge_base kb
    JOIN knowledge_base_embeddings kbe ON kb.id = kbe.knowledge_base_id
    WHERE kb.language = target_language
    AND (1 - (kbe.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY kbe.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to search hotels using semantic similarity
CREATE OR REPLACE FUNCTION search_hotels_semantic(
    query_embedding vector(1536),
    target_language VARCHAR(5) DEFAULT 'en',
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    hotel_id UUID,
    name VARCHAR(255),
    description TEXT,
    city_name TEXT,
    price_per_night INTEGER,
    rating INTEGER,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id as hotel_id,
        h.name,
        h.description->>target_language as description,
        c.names->>target_language as city_name,
        h.price_per_night,
        h.rating,
        (1 - (he.embedding <=> query_embedding)) as similarity
    FROM hotels h
    JOIN hotel_embeddings he ON h.id = he.hotel_id
    JOIN cities c ON h.city_id = c.id
    WHERE he.language = target_language
    AND h.is_active = true
    AND (1 - (he.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY he.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE knowledge_base_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Enable read access for embeddings" ON knowledge_base_embeddings FOR SELECT USING (true);
CREATE POLICY "Enable read access for hotel embeddings" ON hotel_embeddings FOR SELECT USING (true);
CREATE POLICY "Enable read access for query cache" ON query_cache FOR SELECT USING (true);

-- Allow service role to manage all data
CREATE POLICY "Service role can manage embeddings" ON knowledge_base_embeddings FOR ALL USING (true);
CREATE POLICY "Service role can manage hotel embeddings" ON hotel_embeddings FOR ALL USING (true);
CREATE POLICY "Service role can manage query cache" ON query_cache FOR ALL USING (true);
CREATE POLICY "Service role can manage analytics" ON ai_usage_analytics FOR ALL USING (true);

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Generate embeddings for existing knowledge base
-- 3. Generate embeddings for hotel data
-- 4. Implement semantic search in bot code
-- =====================================================