import { Telegraf } from 'telegraf';
import { AiEscalation } from '../types/database';

export class AdminNotificationService {
  private bot: Telegraf;
  private adminId?: string;

  constructor(bot: Telegraf, adminId?: string) {
    this.bot = bot;
    this.adminId = adminId;
  }

  async notifyEscalation(escalation: AiEscalation, userInfo: { id: string; username?: string; first_name?: string }): Promise<void> {
    if (!this.adminId) {
      console.log('Admin ID not configured, skipping notification');
      return;
    }

    try {
      const userDisplay = userInfo.username 
        ? `@${userInfo.username}` 
        : userInfo.first_name 
        ? userInfo.first_name 
        : `User ${userInfo.id}`;

      const message = `🚨 New Escalation Alert
      
User: ${userDisplay} (ID: ${userInfo.id})
Reason: ${escalation.reason}
Time: ${new Date(escalation.created_at || new Date()).toLocaleString()}
Escalation ID: ${escalation.id}

The user has requested to talk to a human representative.`;

      await this.bot.telegram.sendMessage(this.adminId, message);
    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }
}