// =============================================================================
// Carregamento e validação das variáveis de ambiente.
// Falha rápido (no boot) se algo essencial estiver faltando — evita que o
// servidor suba "quase funcionando" e falhe de forma confusa na primeira
// requisição.
// =============================================================================
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  pgPoolMax: Number(process.env.PG_POOL_MAX ?? 10),
  pgIdleTimeoutMs: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),

  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  geminiApiKey: required("GEMINI_API_KEY"),
} as const;
