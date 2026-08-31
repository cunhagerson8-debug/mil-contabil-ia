import { Router } from "express";
import {
  createFirmController,
  deleteFirmController,
  getFirmController,
  listFirmsController,
  updateFirmController,
} from "../controllers/firm.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

router.post("/", createFirmController);

router.get("/", listFirmsController);

router.get("/:firmId", getFirmController);

router.put("/:firmId", updateFirmController);

router.delete("/:firmId", deleteFirmController);

export default router;