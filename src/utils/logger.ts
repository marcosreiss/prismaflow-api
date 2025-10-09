// src/utils/logger.ts
import winston from "winston";

const ENABLE_DEBUG_LOGS = process.env.DEBUG_LOGS === "true";

// Define níveis de log padrão
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define cores para cada nível
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Detecta ambiente (dev/prod)
const isDevelopment = process.env.NODE_ENV !== "production";

// Formato de log customizado
const format = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `[${timestamp}] ${level}: ${message} ${metaString}`;
  })
);

// Transporte: Console (padrão)
const transports: winston.transport[] = [
  new winston.transports.Console({
    level: ENABLE_DEBUG_LOGS ? "debug" : "info",
  }),
];

// (Opcional) Rotação diária de arquivos
/*
import "winston-daily-rotate-file";
transports.push(
  new (winston.transports as any).DailyRotateFile({
    dirname: "logs",
    filename: "%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "10m",
    maxFiles: "14d",
    level: "info",
  })
);
*/

const logger = winston.createLogger({
  levels,
  format,
  transports,
});

export default logger;
