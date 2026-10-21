import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { InventoryController } from "../src/controllers/inventoryController.js";
import type { InventoryPlan } from "../src/models/inventory.js";

function responseRecorder() {
  const result: { body?: unknown } = {};
  const response = {
    json(body: unknown) {
      result.body = body;
      return response;
    },
  } as unknown as Response;
  return { response, result };
}

const emptyPlan = { summary: {}, products: [], topRisks: [], suppliers: {} } as unknown as InventoryPlan;

test("health returns the API status", () => {
  const controller = new InventoryController({} as never, {} as never);
  const { response, result } = responseRecorder();

  controller.health({} as Request, response);

  assert.deepEqual(result.body, { ok: true });
});

test("dashboard forwards the calculated inventory plan", async () => {
  const controller = new InventoryController({ buildPlan: async () => emptyPlan } as never, {} as never);
  const { response, result } = responseRecorder();

  await controller.dashboard({} as Request, response, (() => {}) as NextFunction);

  assert.strictEqual(result.body, emptyPlan);
});

test("dashboard forwards service errors to Express error handling", async () => {
  const failure = new Error("fixture failure");
  const controller = new InventoryController({ buildPlan: async () => { throw failure; } } as never, {} as never);
  const nextError: unknown[] = [];

  await controller.dashboard({} as Request, responseRecorder().response, ((error?: unknown) => nextError.push(error)) as NextFunction);

  assert.deepEqual(nextError, [failure]);
});

test("plan returns the agent narrative and limits priorities to twelve products", async () => {
  const products = Array.from({ length: 15 }, (_, index) => ({ sku: `SKU-${index}` }));
  const inventory = { ...emptyPlan, products } as InventoryPlan;
  const agent = { mode: "rules", model: null, message: "Plano de teste", keyConfigured: false } as const;
  const controller = new InventoryController(
    { buildPlan: async () => inventory } as never,
    { createNarrative: async () => agent } as never,
  );
  const { response, result } = responseRecorder();

  await controller.plan({} as Request, response, (() => {}) as NextFunction);

  assert.deepEqual(result.body, { agent, summary: inventory.summary, priorities: products.slice(0, 12) });
});

test("plan places agent-selected SKUs first without exposing internal ranking metadata", async () => {
  const products = [{ sku: "SKU-1" }, { sku: "SKU-2" }, { sku: "SKU-3" }];
  const inventory = { ...emptyPlan, products } as InventoryPlan;
  const agent = {
    mode: "ai", model: "test-model", message: "Revise SKU-3 primeiro.", keyConfigured: true,
    prioritySkus: ["SKU-3", "SKU-1"],
  } as const;
  const controller = new InventoryController(
    { buildPlan: async () => inventory } as never,
    { createNarrative: async () => agent } as never,
  );
  const { response, result } = responseRecorder();

  await controller.plan({} as Request, response, (() => {}) as NextFunction);

  assert.deepEqual(result.body, {
    agent: { mode: "ai", model: "test-model", message: "Revise SKU-3 primeiro.", keyConfigured: true },
    summary: inventory.summary,
    priorities: [products[2], products[0], products[1]],
  });
});