import supabase from "../supabase.js";
import logger from "../middleware/logger.js";

export async function logEvent(level, message, context = {}) {
  // Log locally
  logger.log({ level, message, context });

  // Save only important logs to Supabase
  if (["error", "warn"].includes(level)) {
    await supabase.from("bot_logs").insert([{ level, message, context }]);
  }
}