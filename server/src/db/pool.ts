// =============================================================================
// Pools PostgreSQL distintos para tráfego operacional e administrativo.
// =============================================================================
// Consultas de negócio usam withTenantContext; operações globais usam os
// helpers administrativos, que assumem roles distintas dentro da transação.
import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.pgPoolMax,
  idleTimeoutMillis: env.pgIdleTimeoutMs,
});

export const adminPool = new Pool({
  connectionString: env.adminDatabaseUrl,
  max: env.pgAdminPoolMax,
  idleTimeoutMillis: env.pgIdleTimeoutMs,
});

pool.on("error", (err) => {
  // Erros em clients ociosos no pool não devem derrubar o processo, mas
  // precisam ser logados — geralmente indicam que o Postgres caiu a conexão.
  // eslint-disable-next-line no-console
  console.error("[pg pool] erro inesperado em client ocioso:", err);
});

adminPool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[pg admin pool] erro inesperado em client ocioso:", err);
});

export async function closePool(): Promise<void> {
  await Promise.all([pool.end(), adminPool.end()]);
}
