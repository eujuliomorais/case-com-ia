import assert from "node:assert/strict";
import test from "node:test";
import { InventoryService } from "../src/services/inventoryService.js";
import type { InventoryRepository, InventoryRow } from "../src/repositories/memoryInventoryRepository.js";

const catalog: InventoryRow[] = [{
  sku: "SKU-1", marca: "Marca", descricao: "Produto de teste", categoria: "Cuidados",
  status: "ativo", fornecedor: "FOR-1", unidade_compra: "un", moq: "1",
  custo_unitario: "10", preco_venda: "20",
}];

const sales: InventoryRow[] = [
  { sku: "SKU-1", data: "2026-09-29", unidades_vendidas: "2", receita: "40" },
  { sku: "SKU-1", data: "2026-09-29", unidades_vendidas: "2", receita: "40" },
];

const stock: InventoryRow[] = [{ sku: "SKU-1", data: "2026-09-29", estoque_disponivel: "3" }];
const purchases: InventoryRow[] = [];
const suppliers: InventoryRow[] = [{ fornecedor: "FOR-1", nome_fornecedor: "Fornecedor de teste" }];

class FixtureRepository implements InventoryRepository {
  calls = 0;

  async rows(filename: string): Promise<InventoryRow[]> {
    this.calls += 1;
    const data: Record<string, InventoryRow[]> = {
      "skus.csv": catalog,
      "vendas_diarias.csv": sales,
      "estoque_diario.csv": stock,
      "compras.csv": purchases,
      "fornecedores.csv": suppliers,
    };
    const rows = data[filename];
    if (!rows) throw new Error(`Unexpected fixture: ${filename}`);
    return rows;
  }
}

test("buildPlan deduplicates identical sales and returns inventory metrics", async () => {
  const service = new InventoryService(new FixtureRepository());

  const plan = await service.buildPlan();

  assert.equal(plan.summary.skuCount, 1);
  assert.equal(plan.summary.activeSkus, 1);
  assert.equal(plan.summary.duplicateSalesRowsIgnored, 1);
  assert.equal(plan.products[0].sku, "SKU-1");
  assert.equal(plan.products[0].supplier, "Fornecedor de teste");
  assert.equal(plan.products[0].stock, 3);
});

test("buildPlan caches the calculated plan for subsequent calls", async () => {
  const repository = new FixtureRepository();
  const service = new InventoryService(repository);

  const [first, second] = await Promise.all([service.buildPlan(), service.buildPlan()]);

  assert.strictEqual(second, first);
  assert.equal(repository.calls, 5);
});