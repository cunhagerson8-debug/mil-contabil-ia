import pg from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const EMAIL = "gersondacunha18@gmail.com";
const NAME = "Gerson da Cunha";

async function main() {
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 10) {
    console.error("Defina ADMIN_PASSWORD com pelo menos 10 caracteres.");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(
      `INSERT INTO users
        (firm_id, role, status, full_name, email, password_hash, auth_provider)
       VALUES
        (NULL, 'platform_admin', 'active', $1, $2, $3, 'password')
       ON CONFLICT (email) WHERE firm_id IS NULL AND deleted_at IS NULL
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role = 'platform_admin',
         status = 'active',
         auth_provider = 'password'
       RETURNING id, full_name, email, role, status`,
      [NAME, EMAIL, passwordHash]
    );

    console.log("Administrador criado/atualizado:");
    console.table(result.rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Erro ao criar administrador:", error.message);
  process.exit(1);
});