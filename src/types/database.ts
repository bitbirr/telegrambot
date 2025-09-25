export interface AiEscalation {
  id?: string;
  user_id: string;
  reason: string;
  created_at?: string;
  resolved?: boolean;
}

export interface CreateEscalationData {
  user_id: string;
  reason: string;
}