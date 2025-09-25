import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const transport = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "bot-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "10m",
  maxFiles: "14d"
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [transport, new winston.transports.Console()]
});

export default logger;