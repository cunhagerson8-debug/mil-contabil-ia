// =============================================================================
// Ponto de entrada do servidor HTTP.
// =============================================================================
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./db/pool.js";
import { startObligationStatusJob } from "./jobs/obligation-status.job.js";

const app = createApp();
startObligationStatusJob();

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[MIL Contábil IA API] ouvindo na porta ${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[server] recebido ${signal}, encerrando graciosamente...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
