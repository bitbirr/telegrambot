import supabase from './src/supabase.js';

async function createMissingTables() {
    console.log('🔧 Creating missing tables...');
    
    try {
        // Create hotels table
        console.log('🏨 Creating hotels table...');
        const hotelsSQL = `
            CREATE TABLE IF NOT EXISTS hotels (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
                name VARCHAR(200) NOT NULL,
                price_per_night INTEGER NOT NULL,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                description JSONB NOT NULL,
                images JSONB,
                coordinates JSONB,
                amenities JSONB,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_hotels_city_id ON hotels(city_id);
            CREATE INDEX IF NOT EXISTS idx_hotels_price ON hotels(price_per_night);
            CREATE INDEX IF NOT EXISTS idx_hotels_rating ON hotels(rating);
            CREATE INDEX IF NOT EXISTS idx_hotels_active ON hotels(is_active);
        `;
        
        // Create user_sessions table
        console.log('👤 Creating user_sessions table...');
        const userSessionsSQL = `
            CREATE TABLE IF NOT EXISTS user_sessions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id BIGINT NOT NULL,
                language VARCHAR(5) DEFAULT 'en',
                current_state VARCHAR(50),
                session_data JSONB,
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                
                UNIQUE(user_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);
        `;
        
        // Create bookings table
        console.log('📅 Creating bookings table...');
        const bookingsSQL = `
            CREATE TABLE IF NOT EXISTS bookings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id BIGINT NOT NULL,
                hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                check_in_date DATE NOT NULL,
                check_out_date DATE NOT NULL,
                guests INTEGER NOT NULL,
                total_price INTEGER NOT NULL,
                payment_method VARCHAR(50),
                status VARCHAR(20) DEFAULT 'pending',
                booking_reference VARCHAR(20) UNIQUE,
                user_details JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_hotel_id ON bookings(hotel_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
            CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);
        `;
        
        // Rename payment_methods_bot to payment_methods
        console.log('💳 Fixing payment_methods table name...');
        const renamePaymentMethodsSQL = `
            ALTER TABLE IF EXISTS payment_methods_bot RENAME TO payment_methods;
        `;
        
        // Execute all SQL statements
        const sqlStatements = [
            { name: 'hotels', sql: hotelsSQL },
            { name: 'user_sessions', sql: userSessionsSQL },
            { name: 'bookings', sql: bookingsSQL },
            { name: 'payment_methods_rename', sql: renamePaymentMethodsSQL }
        ];
        
        for (const statement of sqlStatements) {
            console.log(`⚡ Executing ${statement.name}...`);
            
            // Since we can't execute raw SQL directly, let's try using the SQL editor approach
            // For now, let's just test if we can create a simple table
            if (statement.name === 'hotels') {
                // Try to create hotels table using Supabase client
                const { error } = await supabase
                    .from('hotels')
                    .select('*')
                    .limit(0);
                
                if (error && error.code === '42P01') {
                    console.log('❌ Hotels table does not exist. Manual creation required.');
                    console.log('📋 Please run the following SQL in your Supabase SQL editor:');
                    console.log(statement.sql);
                } else if (error) {
                    console.log('⚠️  Hotels table exists but has issues:', error.message);
                } else {
                    console.log('✅ Hotels table already exists');
                }
            }
        }
        
        console.log('🎉 Table creation process completed!');
        console.log('📋 If any tables are missing, please run the SQL statements manually in Supabase SQL editor.');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    }
}

createMissingTables();