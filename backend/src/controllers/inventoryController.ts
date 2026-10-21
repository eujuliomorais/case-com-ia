import type { NextFunction, Request, Response } from "express";
import { AgentService } from "../services/agentService.js";
import { InventoryService } from "../services/inventoryService.js";

export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly agentService: AgentService,
  ) {}

  health = (_request: Request, response: Response) => response.json({ ok: true });

  dashboard = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(await this.inventoryService.buildPlan());
    } catch (error) {
      next(error);
    }
  };

  plan = async (_request: Request, response: Response, next: NextFunction) => {
    try {
      const inventory = await this.inventoryService.buildPlan();
      const agent = await this.agentService.createNarrative(inventory);
      const { prioritySkus, ...publicAgent } = agent;
      const prioritizedProducts = prioritySkus?.length
        ? [...prioritySkus.map((sku) => inventory.products.find((product) => product.sku === sku))
          .filter((product): product is (typeof inventory.products)[number] => product !== undefined),
        ...inventory.products.filter((product) => !prioritySkus.includes(product.sku))]
        : inventory.products;
      response.json({ agent: publicAgent, summary: inventory.summary, priorities: prioritizedProducts.slice(0, 12) });
    } catch (error) {
      next(error);
    }
  };
}
