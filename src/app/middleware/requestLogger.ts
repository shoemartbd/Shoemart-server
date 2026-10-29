import fs from "fs/promises";
import path from "path";
import { NextFunction, Request, Response } from "express";

const logDir = path.resolve(process.cwd(), "logs");
const DATED_LOG_PATTERN = /^access-(\d{4}-\d{2}-\d{2})\.log$/;

// Optional — not part of the strict env loader so existing deployments
// without it don't break. Defaults to a 7-day retention window.
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS) || 7;

const ensureLogDir = async () => {
  await fs.mkdir(logDir, { recursive: true });
};

const todayLogPath = () => {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logDir, `access-${dateStr}.log`);
};

// Deletes dated access-log files older than RETENTION_DAYS. Runs once at
// startup and then on a daily interval so long-running servers keep sweeping
// without needing a restart.
export const cleanupOldLogs = async () => {
  try {
    await ensureLogDir();
    const files = await fs.readdir(logDir);
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const match = file.match(DATED_LOG_PATTERN);
      if (!match) continue;

      const fileDate = new Date(`${match[1]}T00:00:00Z`).getTime();
      if (fileDate < cutoff) {
        await fs.unlink(path.join(logDir, file));
      }
    }
  } catch (error) {
    console.error("Failed to clean up old access logs:", error);
  }
};

export const startLogCleanupScheduler = () => {
  void cleanupOldLogs();
  setInterval(() => void cleanupOldLogs(), 24 * 60 * 60 * 1000);
};

export const requestLogger = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = process.hrtime.bigint();

  res.on("finish", async () => {
    try {
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number(endTime - startTime) / 1_000_000;
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        responseTimeMs: Number(responseTimeMs.toFixed(2)),
        ip: req.ip,
        userAgent: req.get("user-agent") || "unknown",
      });

      console.log(logEntry);

      await ensureLogDir();
      await fs.appendFile(todayLogPath(), `${logEntry}\n`, "utf8");
    } catch (error) {
      console.error("Failed to write access log:", error);
    }
  });

  next();
};
