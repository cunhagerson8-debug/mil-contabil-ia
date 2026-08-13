// =============================================================================
// withTenantContext — ponto único de integração com RLS.
// =============================================================================
// Espelha exatamente o modelo de sessão descrito em
// database/README.md §4 e database/migrations/011_row_level_security.sql:
//
//   SET LOCAL app.current_user_id = '<uuid>';
//   SET LOCAL app.current_firm_id = '<uuid ou NULL>';
//   SET LOCAL app.current_role    = '<role>';
//
// Toda query de negócio (repositories) DEVE passar por aqui. Isso garante:
//   1. Um único client de conexão é usado para SET LOCAL + a(s) query(s)
//      reais — SET LOCAL só vale para a transação atual, então se a query
//      real fosse executada por outro client do pool, RLS não veria o
//      contexto e bloquearia (ou peor, aplicaria o contexto errado de uma
//      requisição anterior que reusou a conexão sem limpar).
//   2. Se a query lançar erro, a transação é revertida (ROLBACK) e o client
//      é devolvido ao pool — sem vazar conexões nem deixar transações
//      pendentes.
//   3. mil_platform_admin (rotas administrativas) não passa por aqui — usa
//      o pool diretamente, pois o role de banco já tem BYPASSRLS.
// =============================================================================
import { PoolClient } from "pg";
import { pool } from "./pool.js";

export interface TenantContext {
  userId: string;
  firmId: string | null;   // null para platform_admin
  role: string;
}

/**
 * Executa `fn` dentro de uma transação com o contexto de tenant aplicado via
 * SET LOCAL. `fn` recebe o client já configurado — toda query dentro de `fn`
 * deve usar esse client (nunca `pool.query` diretamente), senão RLS não será
 * aplicado.
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // set_config com is_local=true é equivalente a SET LOCAL, mas aceita
    // parametrização seria (SET LOCAL não aceita placeholders $1 do driver).
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [ctx.userId]);
    await client.query("SELECT set_config('app.current_firm_id', $1, true)", [ctx.firmId ?? ""]);
    await client.query("SELECT set_config('app.current_role', $1, true)", [ctx.role]);

    const result = await fn(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {
      // se o ROLLBACK falhar (ex: conexão já caiu), não há nada a fazer além
      // de deixar o erro original propagar — o client será descartado pelo
      // pool de qualquer forma quando release() perceber o estado inválido.
    });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Variante para operações de plataforma (platform_admin) que devem
 * enxergar todos os firms — usa o pool diretamente, SEM SET LOCAL de
 * contexto de tenant, contando com o role de banco mil_platform_admin
 * (BYPASSRLS) configurado na string de conexão administrativa.
 *
 * Usar com cautela: qualquer rota que chame isto deve já ter validado
 * explicitamente que o usuário autenticado é platform_admin (ver
 * middleware/requireRole.ts) ANTES de chegar aqui — esta função não repete
 * essa checagem.
 */
export async function withPlatformContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
