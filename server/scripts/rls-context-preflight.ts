import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const expectedTarget = {
  hostname: "127.0.0.1",
  port: "5434",
  database: "mil_contabil_teste",
};

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetOnly = process.argv.length === 3 && process.argv[2] === "--check-target";
let stage = "local-configuration";
let closePool: (() => Promise<void>) | undefined;

async function main(): Promise<void> {
  try {
    const [passwordFile, contextSecretFile] = await Promise.all([
      readFile(resolve(serverDirectory, ".rls-test-passwords.local"), "utf8"),
      readFile(resolve(serverDirectory, ".rls-test-secret.local"), "utf8"),
    ]);
    const credentials: unknown = JSON.parse(passwordFile);
    if (
      typeof credentials !== "object"
      || credentials === null
      || !("operational" in credentials)
      || !("administrative" in credentials)
      || typeof credentials.operational !== "string"
      || typeof credentials.administrative !== "string"
      || !credentials.operational
      || !credentials.administrative
    ) {
      throw new Error("Invalid local credentials configuration.");
    }

    const contextSecret = contextSecretFile.trim();
    if (Buffer.byteLength(contextSecret, "utf8") < 32) {
      throw new Error("Invalid local RLS context configuration.");
    }

    const operationalUrl = makeLocalUrl("mil_app_login", credentials.operational);
    const administrativeUrl = makeLocalUrl("mil_platform_login", credentials.administrative);
    assertAuthorizedLocalTarget(operationalUrl, "mil_app_login");
    assertAuthorizedLocalTarget(administrativeUrl, "mil_platform_login");

    if (targetOnly) {
      console.log("TARGET=CONFIRMED_LOCAL_TEST");
      return;
    }
    if (process.argv.length !== 2) {
      throw new Error("Unsupported arguments.");
    }

    process.env.RLS_TEST_DATABASE_URL = operationalUrl.toString();
    process.env.RLS_TEST_ADMIN_DATABASE_URL = administrativeUrl.toString();
    process.env.RLS_TEST_CONTEXT_SECRET = contextSecret;
    process.env.DATABASE_URL = operationalUrl.toString();
    process.env.ADMIN_DATABASE_URL = administrativeUrl.toString();
    process.env.RLS_CONTEXT_SECRET = contextSecret;
    process.env.JWT_SECRET = "local-rls-context-preflight-only";
    process.env.GEMINI_API_KEY = "local-rls-context-preflight-no-network";
    process.env.PG_POOL_MAX = "1";

    stage = "database-context-check";
    const [{ withTenantContext }, poolModule] = await Promise.all([
      import("../src/db/withTenantContext.js"),
      import("../src/db/pool.js"),
    ]);
    closePool = poolModule.closePool;

    const expectedContext = {
      userId: randomUUID(),
      firmId: randomUUID(),
      role: "accountant",
    };
    const verified = await withTenantContext(expectedContext, async (client) => {
      const result = await client.query<{
        user_id: string | null;
        firm_id: string | null;
        role: string | null;
      }>(`
        SELECT app_current_user_id()::text AS user_id,
               app_current_firm_id()::text AS firm_id,
               app_current_role() AS role
      `);
      return result.rows[0];
    });

    stage = "context-assertion";
    if (
      verified?.user_id !== expectedContext.userId
      || verified.firm_id !== expectedContext.firmId
      || verified.role !== expectedContext.role
    ) {
      throw new Error("Signed RLS context did not match the synthetic context.");
    }

    stage = "pool-close";
    await closePool();
    closePool = undefined;
    console.log("PREFLIGHT=PASS");
  } catch {
    if (closePool) {
      try {
        await closePool();
      } catch {
        stage = "pool-close";
      }
    }
    console.error(`PREFLIGHT=FAIL;stage=${stage}`);
    process.exitCode = 1;
  }
}

function makeLocalUrl(login: string, password: string): URL {
  const url = new URL(`postgresql://${login}@${expectedTarget.hostname}:${expectedTarget.port}/${expectedTarget.database}`);
  url.password = password;
  return url;
}

function assertAuthorizedLocalTarget(url: URL, expectedLogin: string): void {
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== "postgresql:"
    || url.hostname !== expectedTarget.hostname
    || url.port !== expectedTarget.port
    || database !== expectedTarget.database
    || decodeURIComponent(url.username) !== expectedLogin
    || !url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Connection target is not the authorized local test database.");
  }
}

void main();
