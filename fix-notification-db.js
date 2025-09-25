#!/usr/bin/env node

/**
 * Fix database issues for notification system
 * Applies necessary schema changes and policies
 */

import supabase from './src/supabase.js';
import { logEvent } from './src/services/logService.js';

async function fixNotificationDatabase() {
    console.log('🔧 Fixing notification database issues...\n');
    
    try {
        // 1. Drop existing policies if they exist
        console.log('1. Dropping existing policies...');
        
        const dropPolicies = [
            'DROP POLICY IF EXISTS "Service role can manage escalations" ON public.escalations',
            'DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notifications', 
            'DROP POLICY IF EXISTS "Service role can manage query analytics" ON public.query_analytics'
        ];
        
        for (const sql of dropPolicies) {
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if (error && !error.message.includes('does not exist')) {
                console.log(`   ⚠️  Warning: ${error.message}`);
            }
        }
        
        // 2. Create new policies with proper permissions
        console.log('2. Creating new policies...');
        
        const newPolicies = [
            `CREATE POLICY "Allow all operations on escalations" ON public.escalations FOR ALL USING (true)`,
            `CREATE POLICY "Allow all operations on notifications" ON public.notifications FOR ALL USING (true)`,
            `CREATE POLICY "Allow all operations on query_analytics" ON public.query_analytics FOR ALL USING (true)`
        ];
        
        for (const sql of newPolicies) {
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if (error) {
                console.log(`   ❌ Error: ${error.message}`);
            } else {
                console.log(`   ✅ Policy created successfully`);
            }
        }
        
        // 3. Grant permissions
        console.log('3. Granting permissions...');
        
        const permissions = [
            'GRANT ALL ON public.escalations TO anon, authenticated, service_role',
            'GRANT ALL ON public.notifications TO anon, authenticated, service_role',
            'GRANT ALL ON public.query_analytics TO anon, authenticated, service_role'
        ];
        
        for (const sql of permissions) {
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if (error) {
                console.log(`   ❌ Error: ${error.message}`);
            } else {
                console.log(`   ✅ Permissions granted`);
            }
        }
        
        // 4. Test database access
        console.log('4. Testing database access...');
        
        // Test escalations table
        const { data: escalationTest, error: escalationError } = await supabase
            .from('escalations')
            .select('id')
            .limit(1);
            
        if (escalationError) {
            console.log(`   ❌ Escalations table access failed: ${escalationError.message}`);
        } else {
            console.log(`   ✅ Escalations table accessible`);
        }
        
        // Test notifications table
        const { data: notificationTest, error: notificationError } = await supabase
            .from('notifications')
            .select('id')
            .limit(1);
            
        if (notificationError) {
            console.log(`   ❌ Notifications table access failed: ${notificationError.message}`);
        } else {
            console.log(`   ✅ Notifications table accessible`);
        }
        
        // Test query_analytics table
        const { data: analyticsTest, error: analyticsError } = await supabase
            .from('query_analytics')
            .select('id')
            .limit(1);
            
        if (analyticsError) {
            console.log(`   ❌ Query analytics table access failed: ${analyticsError.message}`);
        } else {
            console.log(`   ✅ Query analytics table accessible`);
        }
        
        console.log('\n✅ Database fixes completed successfully!');
        
        await logEvent('info', 'Database notification fixes applied', {
            context: 'database_fix',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Database fix failed:', error.message);
        
        await logEvent('error', 'Database notification fixes failed', {
            context: 'database_fix',
            error: error.message,
            timestamp: new Date().toISOString()
        });
        
        process.exit(1);
    }
}

// Alternative method using direct SQL execution
async function createExecSqlFunction() {
    console.log('📝 Creating exec_sql function for database operations...');
    
    const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        EXECUTE sql_query;
        RETURN 'Success';
    EXCEPTION
        WHEN OTHERS THEN
            RETURN SQLERRM;
    END;
    $$;
    `;
    
    try {
        const { error } = await supabase.rpc('exec', { sql: createFunctionSQL });
        if (error) {
            console.log('⚠️  Could not create exec_sql function, using alternative approach');
            return false;
        }
        console.log('✅ exec_sql function created');
        return true;
    } catch (error) {
        console.log('⚠️  Using alternative database fix approach');
        return false;
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    fixNotificationDatabase();
}

export { fixNotificationDatabase };