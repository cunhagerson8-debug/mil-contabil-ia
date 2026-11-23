import pg from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

  if (!password || password.length < 10) {
    console.error("Defina ADMIN_PASSWORD com pelo menos 10 caracteres.");
    process.exit(1);
  }

  if (!email || !name) {
    console.error("Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_NAME explicitamente.");
    process.exit(1);
  }

  const databaseUrl = process.env.ADMIN_DATABASE_URL;

  if (!databaseUrl) {
    console.error("ADMIN_DATABASE_URL não definida.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE mil_platform_admin");
    const roleResult = await client.query(`
      SELECT current_user, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const role = roleResult.rows[0];
    if (role?.current_user !== "mil_platform_admin" || role.rolsuper || !role.rolbypassrls) {
      throw new Error("Conexão não assumiu a role administrativa esperada.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(
      `INSERT INTO users
        (firm_id, role, status, full_name, email, password_hash, auth_provider)
       VALUES
        (NULL, 'platform_admin', 'active', $1, $2, $3, 'password')
       ON CONFLICT DO NOTHING
       RETURNING id, full_name, email, role, status`,
      [name, email, passwordHash]
    );

    if (result.rowCount !== 1) {
      throw new Error("Já existe uma conta correspondente; nenhuma conta ou credencial foi alterada.");
    }

    await client.query("COMMIT");
    console.log("Administrador criado:");
    console.table(result.rows.map(({ id, full_name, role, status }) => ({ id, full_name, role, status })));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Erro ao criar administrador:", error.message);
  process.exit(1);
});