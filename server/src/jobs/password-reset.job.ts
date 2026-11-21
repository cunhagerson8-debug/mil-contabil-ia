import { passwordResetService } from "../services/passwordReset.service.js";

const PROCESS_INTERVAL_MS = 5_000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startPasswordResetJob(): NodeJS.Timeout {
  let running = false;
  let cleanupDueAt = 0;

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    try {
      await passwordResetService.processNextRequest();
      if (Date.now() >= cleanupDueAt) {
        await passwordResetService.cleanup();
        cleanupDueAt = Date.now() + CLEANUP_INTERVAL_MS;
      }
    } catch {
      console.error("[password-reset-job] Execução interrompida.");
    } finally {
      running = false;
    }
  }

  void run();
  const interval = setInterval(() => void run(), PROCESS_INTERVAL_MS);
  interval.unref();
  console.log("[password-reset-job] Worker de recuperação iniciado.");
  return interval;
}
