import assert from "node:assert/strict";
import test from "node:test";
import type { InventoryPlan, ProductPlan } from "../src/models/inventory.js";
import { AgentService } from "../src/services/agentService.js";

function product(sku: string, buyQty: number): ProductPlan {
  return {
    sku, description: `Produto ${sku}`, risk: "Ruptura", stock: 1, coverDays: 2,
    leadTime: 10, daysToStockout: 2, orderBy: "2026-09-29", dailyDemand: 1,
    buyQty, unfundedQty: 0, buyCost: buyQty * 10, supplier: "Fornecedor",
  } as ProductPlan;
}

function plan(): InventoryPlan {
  return {
    summary: { plannedSpend: 20, budget: 100, budgetRemaining: 80, purchaseLines: 2 },
    products: [product("SKU-1", 1), product("SKU-2", 1), product("SKU-3", 0)],
    topRisks: [product("SKU-1", 1)],
  } as unknown as InventoryPlan;
}

test("agent validates and returns its ranked purchase SKUs", async () => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      message: "Revise SKU-2 primeiro.", priority_skus: ["SKU-2", "SKU-unknown", "SKU-2", "SKU-1"],
    }) } }],
  }), { status: 200 });

  try {
    const result = await new AgentService().createNarrative(plan());
    assert.equal(result.mode, "ai");
    assert.deepEqual(result.prioritySkus, ["SKU-2", "SKU-1"]);
    assert.equal(result.message, "Revise SKU-2 primeiro.");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
});

test("agent falls back to the local plan when the AI response is invalid", async () => {
  const oldKey = process.env.GROQ_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: "not-json" } }],
  }), { status: 200 });

  try {
    const result = await new AgentService().createNarrative(plan());
    assert.equal(result.mode, "rules");
    assert.match(result.error ?? "", /Não foi possível consultar a IA/);
    assert.match(result.message, /SKU-1|SKU-2/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
});