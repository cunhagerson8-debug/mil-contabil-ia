// =============================================================================
// scripts/run-migrations.mjs
// -----------------------------------------------------------------------------
// Executa todas as migrations em database/migrations/*.sql, em ordem
// numérica, dentro de uma única conexão (não usa o pool da aplicação —
// scripts de infraestrutura são processos de vida curta, separados do
// servidor HTTP de longa duração).
//
// Uso:
//   DATABASE_URL=postgresql://... node scripts/run-migrations.mjs
// =============================================================================
import { readdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "../../database/migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não definida. Configure server/.env a partir de .env.example.");
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // nomes 001_..., 002_... garantem ordem correta via sort lexicográfico

  console.log(`Encontradas ${files.length} migrations em ${migrationsDir}`);

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    for (const file of files) {
      const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
      console.log(`-> Aplicando ${file} ...`);
      await client.query(sql);
      console.log(`   OK`);
    }
    console.log("Todas as migrations aplicadas com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Falha ao aplicar migrations:", err);
  process.exit(1);
});
