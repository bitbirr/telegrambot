import { createClient } from '@supabase/supabase-js';
import { CreateEscalationData, AiEscalation } from '../types/database';

export class SupabaseService {
  private client;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async createEscalation(escalationData: CreateEscalationData): Promise<AiEscalation | null> {
    try {
      const { data, error } = await this.client
        .from('ai_escalations')
        .insert({
          user_id: escalationData.user_id,
          reason: escalationData.reason,
          resolved: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating escalation:', error);
        return null;
      }

      return data as AiEscalation;
    } catch (error) {
      console.error('Error creating escalation:', error);
      return null;
    }
  }
}