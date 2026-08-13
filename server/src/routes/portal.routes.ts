import { Router } from "express";
import { portalController } from "../controllers/portal.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const portalRouter = Router();
portalRouter.use(requireAuth);

// Documents
portalRouter.get("/documents/:clientId", portalController.listDocuments);
portalRouter.post("/documents", portalController.createDocument);

// Guides
portalRouter.get("/guides/:clientId", portalController.listGuides);
portalRouter.post("/guides", portalController.createGuide);
portalRouter.patch("/guides/:id/paid", portalController.markGuidePaid);

// Messages
portalRouter.get("/messages/:clientId", portalController.listMessages);
portalRouter.post("/messages", portalController.createMessage);
portalRouter.patch("/messages/:id/status", portalController.updateMessageStatus);
