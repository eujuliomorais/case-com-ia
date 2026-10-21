import { Router } from "express";
import { InventoryController } from "../controllers/inventoryController.js";

export function inventoryRoutes(controller: InventoryController): Router {
  const router = Router();
  router.get("/health", controller.health);
  router.get("/dashboard", controller.dashboard);
  router.post("/agent/plan", controller.plan);
  return router;
}
