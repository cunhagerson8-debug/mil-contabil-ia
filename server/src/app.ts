// =============================================================================
// Montagem do app Express — middleware global + rotas.
// =============================================================================
import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { companiesRouter } from "./routes/companies.routes.js";
import { clientsRouter } from "./routes/clients.routes.js";
import { invoicesRouter } from "./routes/invoices.routes.js";
import { alertsRouter } from "./routes/alerts.routes.js";
import { portalRouter } from "./routes/portal.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import firmsRouter from "./routes/firms.routes.js";
import { taxObligationsRoutes } from "./routes/tax-obligations.routes.js";
import { employeesRouter } from "./routes/employees.routes.js";
import { milAuditorRoutes } from "./routes/mil-auditor.routes.js";
import { subscriptionsRouter } from "./routes/subscriptions.routes.js";
import { aiChatRouter } from "./routes/ai-chat.routes.js";
import { adminFirmsRouter } from "./routes/admin-firms.routes.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/companies", companiesRouter);
  app.use("/api/clients", clientsRouter);  
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/portal", portalRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/firms", firmsRouter);
  app.use("/api/admin/firms", adminFirmsRouter);
  app.use("/api/tax-obligations", taxObligationsRoutes);
  app.use("/api/employees", employeesRouter);
  app.use("/api/auditor", milAuditorRoutes);
  app.use("/api/subscriptions", subscriptionsRouter);
  app.use("/api/ai", aiChatRouter);
  const frontendDist = fileURLToPath(new URL("../../dist", import.meta.url));

app.use(express.static(frontendDist));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(frontendDist, "index.html"));
});

  // 404 para rotas não mapeadas
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
  });

  app.use(errorHandler);

  return app;
}
