import "server-only";

import pino, { type Logger } from "pino";

type ValidLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

const VALID_LEVELS: readonly ValidLevel[] = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

function resolveLevel(): ValidLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && (VALID_LEVELS as readonly string[]).includes(raw)) {
    return raw as ValidLevel;
  }
  if (process.env.NODE_ENV === "test") return "silent";
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

const isDev = process.env.NODE_ENV === "development";

const REDACT_PATHS =
  process.env.NODE_ENV === "production"
    ? [
        "password",
        "*.password",
        "token",
        "*.token",
        "key",
        "*.key",
        "secret",
        "*.secret",
        "headers.cookie",
        "headers.authorization",
        "req.headers.cookie",
        "req.headers.authorization",
      ]
    : [];

const logger: Logger = pino({
  level: resolveLevel(),
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

export function getLogger(type: string): Logger {
  return logger.child({ type });
}
