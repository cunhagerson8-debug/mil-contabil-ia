// =============================================================================
// scripts/seed-demo-data.mjs
// -----------------------------------------------------------------------------
// Popula o banco com os MESMOS dados de demonstração que hoje vivem em
// modules/*/mockData.ts no frontend — um escritório, as 4 empresas, e os 5
// usuários (um por role), com senha "demo1234" para todos.
//
// IMPORTANTE: o hash bcrypt é calculado AQUI, em tempo de execução, com a
// mesma biblioteca (bcryptjs) e o mesmo custo (BCRYPT_SALT_ROUNDS) que o
// authService usa para validar login — nunca um hash fixo copiado de algum
// lugar. Isso garante que a senha "demo1234" realmente funciona contra
// authService.login() sem depender de um hash calculado manualmente.
//
// Uso (após rodar run-migrations.mjs):
//   DATABASE_URL=postgresql://... node scripts/seed-demo-data.mjs
// =============================================================================
import pg from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const DEMO_PASSWORD = "demo1234";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  try {
    await client.query("BEGIN");

    // Este script roda com o role administrativo da connection string
    // (deve ter BYPASSRLS — ex: o próprio superuser do banco em ambiente
    // de seed, NUNCA o role mil_app em produção) precisamente porque
    // está inserindo o PRIMEIRO usuário do firm, antes de existir qualquer
    // sessão autenticada que pudesse fornecer app.current_firm_id.

    const firmResult = await client.query(
      `INSERT INTO firms (name, trade_name, cnpj, status, email, trial_ends_at)
       VALUES ('Ferreira & Souza Contabilidade', 'Ferreira & Souza', '11.222.333/0001-44', 'active', 'contato@ferreirasouza.com.br', now() + interval '30 days')
       ON CONFLICT (cnpj) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const firmId = firmResult.rows[0].id;
    console.log(`Firm criado/atualizado: ${firmId}`);

    const companies = [
      { razaoSocial: "Padaria Pão Dourado Ltda", nomeFantasia: "Pão Dourado", cnpj: "12.345.678/0001-90", cnae: "4721-1/02", regime: "simples_nacional", responsavel: "Marcos Vinícius Silva", dataAbertura: "2018-03-14" },
      { razaoSocial: "Tech Solutions Desenvolvimento de Software S.A.", nomeFantasia: "Tech Solutions", cnpj: "23.456.789/0001-11", cnae: "6201-5/01", regime: "lucro_presumido", responsavel: "Fernanda Lima", dataAbertura: "2015-07-22" },
      { razaoSocial: "João Pedro Consultoria MEI", nomeFantasia: "JP Consultoria", cnpj: "34.567.890/0001-22", cnae: "7020-4/00", regime: "mei", responsavel: "João Pedro Santos", dataAbertura: "2022-01-10" },
      { razaoSocial: "Indústria Metalúrgica Santa Fé Ltda", nomeFantasia: "Metalúrgica Santa Fé", cnpj: "45.678.901/0001-33", cnae: "2542-0/00", regime: "lucro_real", responsavel: "Patrícia Mendes", dataAbertura: "2010-11-02", status: "em_encerramento" },
    ];

    const companyIds = {};
    for (const c of companies) {
      const result = await client.query(
        `INSERT INTO companies (firm_id, razao_social, nome_fantasia, cnpj, cnae, regime, responsavel, status, data_abertura)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (firm_id, cnpj) DO UPDATE SET nome_fantasia = EXCLUDED.nome_fantasia
         RETURNING id`,
        [firmId, c.razaoSocial, c.nomeFantasia, c.cnpj, c.cnae, c.regime, c.responsavel, c.status ?? "ativa", c.dataAbertura]
      );
      companyIds[c.nomeFantasia] = result.rows[0].id;
      console.log(`Empresa criada/atualizada: ${c.nomeFantasia} (${result.rows[0].id})`);
    }

    const users = [
      { fullName: "Beatriz Andrade", email: "beatriz@milgestao.com.br", role: "platform_admin", firmId: null },
      { fullName: "Ana Paula Ferreira", email: "ana.ferreira@ferreirasouza.com.br", role: "firm_owner", firmId },
      { fullName: "Carlos Eduardo Souza", email: "carlos.souza@ferreirasouza.com.br", role: "accountant", firmId },
      { fullName: "Fernanda Lima", email: "fernanda@techsolutions.com.br", role: "company_manager", firmId, companyAccess: ["Tech Solutions"], canManage: true },
      { fullName: "Rodrigo Almeida", email: "rodrigo@techsolutions.com.br", role: "company_user", firmId, companyAccess: ["Tech Solutions"], canManage: false },
    ];

    for (const u of users) {
      // uq_users_platform_admin_email (email) cobre firm_id IS NULL;
      // uq_users_email_per_firm (firm_id, email) cobre os demais. São dois
      // índices parciais distintos (ver 002_firms_and_users.sql) — o
      // ON CONFLICT precisa apontar para o índice certo em cada caso, já
      // que o Postgres exige correspondência exata com a constraint/índice.
      const result = u.firmId === null
        ? await client.query(
            `INSERT INTO users (firm_id, role, status, full_name, email, password_hash, auth_provider)
             VALUES (NULL,$1,'active',$2,$3,$4,'password')
             ON CONFLICT (email) WHERE firm_id IS NULL AND deleted_at IS NULL
             DO UPDATE SET password_hash = EXCLUDED.password_hash
             RETURNING id`,
            [u.role, u.fullName, u.email, passwordHash]
          )
        : await client.query(
            `INSERT INTO users (firm_id, role, status, full_name, email, password_hash, auth_provider)
             VALUES ($1,$2,'active',$3,$4,$5,'password')
             ON CONFLICT (firm_id, email) WHERE deleted_at IS NULL
             DO UPDATE SET password_hash = EXCLUDED.password_hash
             RETURNING id`,
            [u.firmId, u.role, u.fullName, u.email, passwordHash]
          );
      const userId = result.rows[0].id;
      console.log(`Usuário criado/atualizado: ${u.fullName} <${u.email}> (${userId})`);

      if (u.companyAccess) {
        for (const companyName of u.companyAccess) {
          await client.query(
            `INSERT INTO user_company_access (user_id, company_id, can_manage)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, company_id) DO UPDATE SET can_manage = EXCLUDED.can_manage`,
            [userId, companyIds[companyName], u.canManage]
          );
        }
      }
    }

    await client.query("COMMIT");
    console.log(`\nSeed concluído. Senha para todos os usuários de demonstração: "${DEMO_PASSWORD}"`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Falha ao popular dados de demonstração:", err);
  process.exit(1);
});
