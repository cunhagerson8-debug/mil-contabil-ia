// =============================================================================
// Carregamento e validação das variáveis de ambiente.
// Falha rápido (no boot) se algo essencial estiver faltando — evita que o
// servidor suba "quase funcionando" e falhe de forma confusa na primeira
// requisição.
// =============================================================================
import "dotenv/config";
import { areBackgroundJobsDisabled } from "./background-jobs.js";

const inviteTokenTtlHours = Number(process.env.INVITE_TOKEN_TTL_HOURS ?? 72);

if (!Number.isInteger(inviteTokenTtlHours) || inviteTokenTtlHours < 1 || inviteTokenTtlHours > 168) {
  throw new Error("INVITE_TOKEN_TTL_HOURS deve ser um número inteiro entre 1 e 168.");
}

const databaseUrl = required("DATABASE_URL");
const adminDatabaseUrl = required("ADMIN_DATABASE_URL");
const rlsContextSecret = required("RLS_CONTEXT_SECRET");
const jwtSecret = required("JWT_SECRET");

if (Buffer.byteLength(rlsContextSecret, "utf8") < 32) {
  throw new Error("RLS_CONTEXT_SECRET deve conter pelo menos 32 bytes.");
}
if (rlsContextSecret === jwtSecret) {
  throw new Error("RLS_CONTEXT_SECRET e JWT_SECRET devem ser chaves distintas.");
}

if (databaseUrl === adminDatabaseUrl) {
  throw new Error("DATABASE_URL e ADMIN_DATABASE_URL devem usar conexões distintas.");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl,
  adminDatabaseUrl,
  pgPoolMax: Number(process.env.PG_POOL_MAX ?? 10),
  pgAdminPoolMax: Number(process.env.PG_ADMIN_POOL_MAX ?? 2),
  pgIdleTimeoutMs: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),

  jwtSecret,
  rlsContextSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  inviteTokenTtlHours,

  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  geminiApiKey: required("GEMINI_API_KEY"),
  disableBackgroundJobs: areBackgroundJobsDisabled(process.env.DISABLE_BACKGROUND_JOBS),
  // Opcional no boot: sem a chave, apenas o envio de e-mail falha (de forma tratada).
  resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
} as const;
