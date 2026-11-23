import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://tenant-test:tenant-test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://platform-test:platform-test@localhost:5432/test";
process.env.JWT_SECRET = "hr-route-test-secret";
process.env.RLS_CONTEXT_SECRET = "hr-route-rls-context-test-secret-0123456789";
process.env.GEMINI_API_KEY = "hr-route-test";

const { employeesRouter } = await import("../src/routes/employees.routes.js");

type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: never, res: never, next: (error?: unknown) => void) => void }>;
  };
};

const routerStack = (employeesRouter as unknown as { stack: RouteLayer[] }).stack;

function routeAuthorization(
  method: string,
  path: string,
  role?: string,
  permissions: Array<{ companyId: string; permissions: string[] }> = [],
): Promise<unknown | null> {
  const layer = routerStack.find((candidate) =>
    candidate.route?.path === path && candidate.route.methods[method.toLowerCase()]
  );
  assert.ok(layer?.route, `Rota ${method} ${path} deve existir`);
  const guards = layer.route.stack.slice(0, -1).map(({ handle }) => handle);
  assert.ok(guards.length > 0, `Rota ${method} ${path} deve iniciar com autorização`);

  return new Promise((resolve) => {
    const req = {
      tenantContext: role
        ? { userId: "synthetic-user", firmId: "synthetic-firm", role, hrPermissions: permissions }
        : undefined,
    } as never;
    let guardIndex = 0;
    const runNext = (error?: unknown) => {
      if (error || guardIndex >= guards.length) {
        resolve(error ?? null);
        return;
      }
      const guard = guards[guardIndex++];
      try {
        guard(req, {} as never, runNext);
      } catch (guardError) {
        resolve(guardError);
      }
    };
    runNext();
  });
}

test("rotas RH exigem contexto autenticado", async () => {
  for (const [method, path] of [["GET", "/"], ["POST", "/"], ["PUT", "/:id"], ["DELETE", "/:id"]]) {
    const error = await routeAuthorization(method, path);
    assert.equal((error as Error)?.name, "UnauthorizedError", `${method} ${path} deve exigir autenticação`);
  }
});

test("somente equipe autorizada acessa leitura e escrita de RH", async () => {
  const staffRoles = ["firm_owner", "accountant"];
  const routes = [
    ["GET", "/"],
    ["GET", "/departments"],
    ["GET", "/:id"],
    ["POST", "/"],
    ["PUT", "/:id"],
  ];
  const deniedStaffOperations: string[] = [];
  const unauthorizedPortalOperations: string[] = [];

  for (const [method, path] of routes) {
    for (const role of staffRoles) {
      if (await routeAuthorization(method, path, role) !== null) {
        deniedStaffOperations.push(`${role} ${method} ${path}`);
      }
    }

    for (const role of ["company_manager", "company_user", "platform_admin"]) {
      const error = await routeAuthorization(method, path, role);
      if ((error as Error | null)?.name !== "ForbiddenError") {
        unauthorizedPortalOperations.push(`${role} ${method} ${path}`);
      }
    }
  }

  assert.deepEqual(deniedStaffOperations, [], "equipe autorizada deve acessar leitura e escrita de RH");
  assert.deepEqual(
    unauthorizedPortalOperations,
    [],
    "perfis sem permissão explícita de RH não devem acessar leitura nem escrita",
  );
});

test("somente firm_owner pode remover colaborador pela API", async () => {
  assert.equal(await routeAuthorization("DELETE", "/:id", "firm_owner"), null);

  const unauthorizedDeletes: string[] = [];
  for (const role of ["accountant", "company_manager", "company_user", "platform_admin"]) {
    const error = await routeAuthorization("DELETE", "/:id", role);
    if ((error as Error | null)?.name !== "ForbiddenError") unauthorizedDeletes.push(role);
  }
  assert.deepEqual(unauthorizedDeletes, [], "somente firm_owner deve remover colaborador");
});

test("perfis do portal precisam da concessão RH correspondente à operação", async () => {
  const grants = [{ companyId: "synthetic-company", permissions: ["employee.read"] }];
  assert.equal(await routeAuthorization("GET", "/", "company_manager", grants), null);
  assert.equal(
    (await routeAuthorization("POST", "/", "company_manager", grants) as Error).name,
    "ForbiddenError",
    "leitura não deve autorizar cadastro",
  );

  const manageGrant = [{
    companyId: "synthetic-company",
    permissions: ["employee.read", "employee.sensitive.read", "employee.manage"],
  }];
  assert.equal(await routeAuthorization("POST", "/", "company_user", manageGrant), null);
  assert.equal(await routeAuthorization("PUT", "/:id", "company_user", manageGrant), null);
});
