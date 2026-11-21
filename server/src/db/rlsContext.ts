import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import type { TenantContext } from "./withTenantContext.js";

const TENANT_ROLES = new Set([
  "firm_owner",
  "accountant",
  "company_manager",
  "company_user",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const RLS_CONTEXT_TTL_SECONDS = 900;

export interface RlsTransactionBinding {
  backendPid: number;
  transactionId: string;
  databaseName: string;
  sessionUser: string;
}

export function signRlsContext(ctx: TenantContext, binding: RlsTransactionBinding): string {
  if (
    !UUID_PATTERN.test(ctx.userId)
    || !ctx.firmId
    || !UUID_PATTERN.test(ctx.firmId)
    || !TENANT_ROLES.has(ctx.role)
    || !Number.isSafeInteger(binding.backendPid)
    || binding.backendPid <= 0
    || !/^\d+$/.test(binding.transactionId)
    || !binding.databaseName
    || binding.sessionUser !== "mil_app_login"
  ) {
    throw new Error("Contexto RLS inválido.");
  }

  const payload = Buffer.from(JSON.stringify({
    v: 1,
    userId: ctx.userId,
    firmId: ctx.firmId,
    role: ctx.role,
    expiresAt: Math.floor(Date.now() / 1000) + RLS_CONTEXT_TTL_SECONDS,
    backendPid: binding.backendPid,
    transactionId: binding.transactionId,
    databaseName: binding.databaseName,
    sessionUser: binding.sessionUser,
  }), "utf8").toString("base64");
  const signature = createHmac("sha256", env.rlsContextSecret)
    .update(payload, "utf8")
    .digest("hex");

  return `${payload}.${signature}`;
}
