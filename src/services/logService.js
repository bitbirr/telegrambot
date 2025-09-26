import supabase from "../supabase.js";
import logger from "../middleware/logger.js";

export async function logEvent(level, message, context = {}) {
  // Log locally
  logger.log({ level, message, context });

  // Save only important logs to Supabase if available
  if (["error", "warn"].includes(level) && supabase) {
    try {
      await supabase.from("bot_logs").insert([{ level, message, context }]);
    } catch (error) {
      // Fallback to console if Supabase fails
      console.error('Failed to log to Supabase:', error.message);
    }
  }
}