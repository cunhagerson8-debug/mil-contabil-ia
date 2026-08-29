// ============================================================================
// scripts/run-migrations.mjs
// ============================================================================
// Executa as migrations em database/migrations/*.sql em ordem numérica,
// registrando quais já foram aplicadas.
//
// Uso:
//   DATABASE_URL=postgresql://... node scripts/run-migrations.mjs
// ============================================================================

import { readdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import "dotenv/config";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "../../database/migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(
      "DATABASE_URL não definida. Configure server/.env a partir de .env.example."
    );
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Encontradas ${files.length} migrations em ${migrationsDir}`);

  const client = new Client({ connectionString });

  await client.connect();

  try {
    // Tabela que controla quais migrations já foram executadas.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const file of files) {
      const result = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1",
        [file]
      );

      if (result.rowCount > 0) {
        console.log(`⏭️  ${file} já aplicada — pulando.`);
        continue;
      }

      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");

      console.log(`▶ Aplicando ${file}...`);

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );

        await client.query("COMMIT");

        console.log(`   ✓ ${file} aplicada com sucesso.`);
      } catch (error) {
        await client.query("ROLLBACK");

        console.error(`   ✗ Erro ao aplicar ${file}.`);
        throw error;
      }
    }

    console.log("Todas as migrations pendentes foram aplicadas.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Falha ao aplicar migrations:", err);
  process.exit(1);
});