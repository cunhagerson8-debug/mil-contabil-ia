// =============================================================================
// Pool de conexões PostgreSQL — singleton único para toda a aplicação.
// =============================================================================
// IMPORTANTE: este pool NUNCA deve ser usado diretamente para queries que
// dependem de RLS (ou seja, praticamente todas as queries de negócio). RLS
// depende de variáveis de sessão (app.current_firm_id etc.) setadas via
// SET LOCAL, que só têm efeito dentro de uma ÚNICA conexão/transação. Como
// pool.query() pode usar uma conexão diferente a cada chamada, usar SET LOCAL
// e depois pool.query() para a query real corre o risco de a variável de
// sessão não estar setada na conexão que efetivamente executa a query.
//
// Por isso, toda query de negócio passa por withTenantContext() (ver
// ./withTenantContext.ts), que faz checkout explícito de UM client do pool,
// abre uma transação, seta as variáveis de sessão e só então executa a
// query — garantindo que RLS é aplicado corretamente.
// =============================================================================
import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.pgPoolMax,
  idleTimeoutMillis: env.pgIdleTimeoutMs,
});

pool.on("error", (err) => {
  // Erros em clients ociosos no pool não devem derrubar o processo, mas
  // precisam ser logados — geralmente indicam que o Postgres caiu a conexão.
  // eslint-disable-next-line no-console
  console.error("[pg pool] erro inesperado em client ocioso:", err);
});

export async function closePool(): Promise<void> {
  await pool.end();
}
