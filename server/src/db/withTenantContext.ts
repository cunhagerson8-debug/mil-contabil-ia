// =============================================================================
// withTenantContext — ponto único de integração com RLS.
// =============================================================================
// Usa o modelo de contexto assinado da migration 019. GUCs customizados de
// identidade podem ser alterados por SQL e não são uma fonte de autorização.
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
//   3. operações globais usam pool separado e assumem mil_platform_admin
//      apenas dentro da transação administrativa.
// =============================================================================
import { PoolClient } from "pg";
import { adminPool, pool } from "./pool.js";
import { signRlsContext } from "./rlsContext.js";
import type { HrCompanyPermissionGrant } from "../types/hr-permissions.js";

export interface TenantContext {
  userId: string;
  firmId: string | null;   // null para platform_admin
  role: string;
  hrPermissions?: HrCompanyPermissionGrant[];
}

async function assertOperationalRole(client: PoolClient): Promise<void> {
  const roleResult = await client.query<{
    session_user_name: string;
    session_can_login: boolean;
    session_superuser: boolean;
    session_bypassrls: boolean;
    session_inherit: boolean;
    session_has_privileged_membership: boolean;
    session_has_unexpected_membership: boolean;
    session_can_assume_platform_admin: boolean;
    effective_role: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    owns_rls_tables: boolean;
    has_privileged_membership: boolean;
    effective_has_membership: boolean;
  }>(`
    SELECT session_user AS session_user_name,
           session_role.rolcanlogin AS session_can_login,
           session_role.rolsuper AS session_superuser,
           session_role.rolbypassrls AS session_bypassrls,
           session_role.rolinherit AS session_inherit,
           EXISTS (
             SELECT 1
             FROM pg_roles privileged_role
             WHERE (privileged_role.rolsuper OR privileged_role.rolbypassrls)
               AND pg_has_role(session_role.oid, privileged_role.oid, 'MEMBER')
           ) AS session_has_privileged_membership,
           EXISTS (
             SELECT 1
             FROM pg_auth_members membership
             JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
             WHERE membership.member = session_role.oid
               AND granted_role.rolname <> 'mil_app'
           ) AS session_has_unexpected_membership,
           pg_has_role(session_role.oid, 'mil_platform_admin', 'MEMBER')
             AS session_can_assume_platform_admin,
           current_user AS effective_role,
           r.rolsuper,
           r.rolbypassrls,
           EXISTS (
             SELECT 1
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public'
               AND c.relkind IN ('r', 'p')
               AND c.relrowsecurity
               AND pg_has_role(r.oid, c.relowner, 'USAGE')
           ) AS owns_rls_tables,
           EXISTS (
             SELECT 1
             FROM pg_roles privileged_role
             WHERE (privileged_role.rolsuper OR privileged_role.rolbypassrls)
               AND pg_has_role(r.oid, privileged_role.oid, 'MEMBER')
           ) AS has_privileged_membership,
           EXISTS (
             SELECT 1 FROM pg_auth_members membership
             WHERE membership.member = r.oid
           ) AS effective_has_membership
    FROM pg_roles r
    JOIN pg_roles session_role ON session_role.rolname = session_user
    WHERE r.rolname = current_user
  `);
  const role = roleResult.rows[0];
  if (
    role?.session_user_name !== "mil_app_login"
    || !role.session_can_login
    || role.session_superuser
    || role.session_bypassrls
    || role.session_inherit
    || role.session_has_privileged_membership
    || role.session_has_unexpected_membership
    || role.session_can_assume_platform_admin
    || role?.effective_role !== "mil_app"
    || role.rolsuper
    || role.rolbypassrls
    || role.owns_rls_tables
    || role.has_privileged_membership
    || role.effective_has_membership
  ) {
    throw new Error("A conexão operacional não está usando a role mil_app sujeita a RLS.");
  }
}

/**
 * Executa `fn` com um contexto assinado pelo backend e vinculado à transação
 * e à conexão atuais. Os GUCs de identidade legados não são uma fonte de
 * autenticação; as funções RLS verificam a assinatura em cada uso.
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!ctx.firmId || ctx.role === "platform_admin") {
    throw new Error("Contexto de tenant inválido: firmId e role de escritório são obrigatórios.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE mil_app");
    // Neutraliza valores legados em conexões reutilizadas; não substitui a
    // migration 019. A versão nova não deve atender tráfego antes da migration.
    await client.query(`
      SELECT set_config('app.current_user_id', '', true),
             set_config('app.current_firm_id', '', true),
             set_config('app.current_role', '', true)
    `);

    const roleResult = await client.query<{
      session_user_name: string;
      session_can_login: boolean;
      session_superuser: boolean;
      session_bypassrls: boolean;
      session_inherit: boolean;
      session_has_privileged_membership: boolean;
      session_has_unexpected_membership: boolean;
      session_can_assume_platform_admin: boolean;
      effective_role: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      owns_rls_tables: boolean;
      has_privileged_membership: boolean;
      effective_has_membership: boolean;
    }>(`
      SELECT session_user AS session_user_name,
             session_role.rolcanlogin AS session_can_login,
             session_role.rolsuper AS session_superuser,
             session_role.rolbypassrls AS session_bypassrls,
             session_role.rolinherit AS session_inherit,
             EXISTS (
               SELECT 1
               FROM pg_roles privileged_role
               WHERE (privileged_role.rolsuper OR privileged_role.rolbypassrls)
                 AND pg_has_role(session_role.oid, privileged_role.oid, 'MEMBER')
             ) AS session_has_privileged_membership,
             EXISTS (
               SELECT 1
               FROM pg_auth_members membership
               JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
               WHERE membership.member = session_role.oid
                 AND granted_role.rolname <> 'mil_app'
             ) AS session_has_unexpected_membership,
             pg_has_role(session_role.oid, 'mil_platform_admin', 'MEMBER')
               AS session_can_assume_platform_admin,
             current_user AS effective_role,
             r.rolsuper,
             r.rolbypassrls,
             EXISTS (
               SELECT 1
               FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public'
                 AND c.relkind IN ('r', 'p')
                 AND c.relrowsecurity
                 AND pg_has_role(r.oid, c.relowner, 'USAGE')
             ) AS owns_rls_tables,
             EXISTS (
               SELECT 1
               FROM pg_roles privileged_role
               WHERE (privileged_role.rolsuper OR privileged_role.rolbypassrls)
                 AND pg_has_role(r.oid, privileged_role.oid, 'MEMBER')
             ) AS has_privileged_membership,
             EXISTS (
               SELECT 1 FROM pg_auth_members membership
               WHERE membership.member = r.oid
             ) AS effective_has_membership
      FROM pg_roles r
      JOIN pg_roles session_role ON session_role.rolname = session_user
      WHERE r.rolname = current_user
    `);
    const role = roleResult.rows[0];
    if (
      role?.session_user_name !== "mil_app_login"
      || !role.session_can_login
      || role.session_superuser
      || role.session_bypassrls
      || role.session_inherit
      || role.session_has_privileged_membership
      || role.session_has_unexpected_membership
      || role.session_can_assume_platform_admin
      || role?.effective_role !== "mil_app"
      || role.rolsuper
      || role.rolbypassrls
      || role.owns_rls_tables
      || role.has_privileged_membership
      || role.effective_has_membership
    ) {
      throw new Error("A conexão operacional não está usando a role mil_app sujeita a RLS.");
    }

    const bindingResult = await client.query<{
      backend_pid: number;
      transaction_id: string;
      database_name: string;
      session_user_name: string;
    }>(`
      SELECT pg_backend_pid() AS backend_pid,
             txid_current()::text AS transaction_id,
             current_database() AS database_name,
             session_user AS session_user_name
    `);
    const binding = bindingResult.rows[0];
    if (!binding) {
      throw new Error("Não foi possível vincular o contexto RLS à transação.");
    }

    const signedContext = signRlsContext(ctx, {
      backendPid: binding.backend_pid,
      transactionId: binding.transaction_id,
      databaseName: binding.database_name,
      sessionUser: binding.session_user_name,
    });
    await client.query("SELECT app_private.set_rls_context($1)", [signedContext]);

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
 * Public lead writes run as mil_app with the same operational-role checks as
 * tenant queries; table grants and RLS limit this context to lead submission.
 */
export async function withPublicLeadContext<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE mil_app");
    await client.query(`
      SELECT set_config('app.current_user_id', '', true),
             set_config('app.current_firm_id', '', true),
             set_config('app.current_role', '', true)
    `);
    await assertOperationalRole(client);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Variante para operações globais autorizadas pela camada de serviço ou
 * rota. Usa o pool administrativo e assume mil_platform_admin somente
 * dentro desta transação.
 *
 * Usar com cautela: qualquer rota que chame isto deve já ter validado
 * explicitamente que o usuário autenticado é platform_admin (ver
 * middleware/requireRole.ts) ANTES de chegar aqui — esta função não repete
 * essa checagem.
 */
export async function withPlatformContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE mil_platform_admin");
    await assertPlatformRole(client);
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

/**
 * Contexto exclusivo para leituras globais administrativas. O chamador
 * deve validar a autorização antes desta função; a transação assume
 * mil_platform_admin e confirma que a role não é superuser.
 */
export async function withPlatformReadOnlyContext<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL ROLE mil_platform_admin");
    await assertPlatformRole(client);

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

async function assertPlatformRole(client: PoolClient): Promise<void> {
  const roleResult = await client.query<{
    session_user_name: string;
    session_can_login: boolean;
    session_superuser: boolean;
    session_bypassrls: boolean;
    session_inherit: boolean;
    session_has_unexpected_privileged_membership: boolean;
    session_has_unexpected_membership: boolean;
    effective_role: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
  }>(`
      SELECT session_user AS session_user_name,
             session_role.rolcanlogin AS session_can_login,
             session_role.rolsuper AS session_superuser,
             session_role.rolbypassrls AS session_bypassrls,
             session_role.rolinherit AS session_inherit,
             EXISTS (
               SELECT 1
               FROM pg_roles privileged_role
               WHERE (privileged_role.rolsuper
                      OR (privileged_role.rolbypassrls AND privileged_role.rolname <> 'mil_platform_admin'))
                 AND pg_has_role(session_role.oid, privileged_role.oid, 'MEMBER')
             ) AS session_has_unexpected_privileged_membership,
             EXISTS (
               SELECT 1
               FROM pg_auth_members membership
               JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
               WHERE membership.member = session_role.oid
                 AND granted_role.rolname <> 'mil_platform_admin'
             ) AS session_has_unexpected_membership,
             current_user AS effective_role,
             effective_role.rolsuper,
             effective_role.rolbypassrls
      FROM pg_roles effective_role
      JOIN pg_roles session_role ON session_role.rolname = session_user
      WHERE effective_role.rolname = current_user
    `);
  const role = roleResult.rows[0];
  if (
    role?.session_user_name !== "mil_platform_login"
    || !role.session_can_login
    || role.session_superuser
    || role.session_bypassrls
    || role.session_inherit
    || role.session_has_unexpected_privileged_membership
    || role.session_has_unexpected_membership
    || role?.effective_role !== "mil_platform_admin"
    || role.rolsuper
    || !role.rolbypassrls
  ) {
    throw new Error("A conexão administrativa não assumiu mil_platform_admin conforme esperado.");
  }
}
