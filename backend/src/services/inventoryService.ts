import type { InventoryRow, InventoryRepository } from "../repositories/memoryInventoryRepository.js";
import type { InventoryPlan, ProductPlan } from "../models/inventory.js";
import { defaultBusinessParameters, type BusinessParameters } from "../config/businessParameters.js";

const dayMs = 86_400_000;
type Day = number;

function day(value: string | undefined): Day | null {
  if (!value) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / dayMs);
}

function dayString(value: Day): string {
  return new Date(value * dayMs).toISOString().slice(0, 10);
}

function percentile(values: number[], pct: number, fallback: number): number {
  if (!values.length) return fallback;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(pct * ordered.length) - 1))];
}

function unitFactor(unit: string): number {
  return unit.trim().toLowerCase() === "cx 12 un" ? 12 : 1;
}

function number(row: InventoryRow, key: string): number {
  const result = Number(row[key]);
  if (!Number.isFinite(result)) throw new Error(`Valor numérico inválido na coluna ${key}`);
  return result;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round = (value: number) => Math.round(value);
const active = (product: ProductPlan) => product.status === "ativo";

function shiftYear(value: string, years: number): string {
  const timestamp = day(value)!;
  const date = new Date(timestamp * dayMs);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function serviceZ(serviceLevelPercent: number): number {
  const p = serviceLevelPercent / 100;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425;
  const high = 1 - low;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > high) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function projectedDaysToStockout(
  stock: number,
  demandPerDay: number,
  reference: Day,
  planStart: Day,
  inbound: Array<{ date: Day; quantity: number }>,
  horizon: number,
): number | null {
  if (demandPerDay <= 0) return null;
  let balance = stock;
  let inboundIndex = 0;
  for (let offset = 0; offset < horizon; offset += 1) {
    const date = planStart + offset;
    while (inboundIndex < inbound.length && inbound[inboundIndex].date <= date) {
      balance += inbound[inboundIndex].quantity;
      inboundIndex += 1;
    }
    balance -= demandPerDay;
    if (balance < 0) return date - reference;
  }
  return null;
}

export class InventoryService {
  private cachedPlan: { expiresAt: number; plan: InventoryPlan } | null = null;
  private pendingPlan: Promise<InventoryPlan> | null = null;

  constructor(
    private readonly repository: InventoryRepository,
    private readonly parameters: BusinessParameters = defaultBusinessParameters,
  ) {}

  async buildPlan(): Promise<InventoryPlan> {
    if (this.cachedPlan && this.cachedPlan.expiresAt > Date.now()) return this.cachedPlan.plan;
    if (this.pendingPlan) return this.pendingPlan;

    this.pendingPlan = this.calculatePlan()
      .then((plan) => {
        this.cachedPlan = { plan, expiresAt: Date.now() + 60_000 };
        return plan;
      })
      .finally(() => { this.pendingPlan = null; });
    return this.pendingPlan;
  }

  private async calculatePlan(): Promise<InventoryPlan> {
    const [catalogRows, salesRows, stockRows, purchaseRows, supplierRows] = await Promise.all([
      this.repository.rows("skus.csv"),
      this.repository.rows("vendas_diarias.csv"),
      this.repository.rows("estoque_diario.csv"),
      this.repository.rows("compras.csv"),
      this.repository.rows("fornecedores.csv"),
    ]);
    const catalog = new Map(catalogRows.map((row) => [row.sku, row]));
    const supplierNames = Object.fromEntries(supplierRows.map((row) => [row.fornecedor, row.nome_fornecedor]));
    const reference = day(this.parameters.referenceDate)!;
    const historyStart = day(this.parameters.historyStart)!;
    const planStart = day(this.parameters.planStart)!;
    const planEnd = day(this.parameters.planEnd)!;
    const planDays = planEnd - planStart + 1;
    const zValue = serviceZ(this.parameters.serviceLevel);

    const sales = new Map<string, Map<Day, number>>();
    const salesRevenue = new Map<string, number>();
    const salesUnitsForRevenue = new Map<string, number>();
    const seenSalesRecords = new Set<string>();
    let duplicateSalesRowsIgnored = 0;
    for (const record of salesRows) {
      const date = day(record.data);
      if (date !== null && date >= historyStart && date <= reference) {
        const quantity = number(record, "unidades_vendidas");
        const revenue = number(record, "receita");
        const fingerprint = JSON.stringify([record.sku, date, quantity, revenue]);
        if (seenSalesRecords.has(fingerprint)) {
          duplicateSalesRowsIgnored += 1;
          continue;
        }
        seenSalesRecords.add(fingerprint);
        if (!sales.has(record.sku)) sales.set(record.sku, new Map());
        const byDate = sales.get(record.sku)!;
        byDate.set(date, (byDate.get(date) ?? 0) + quantity);
        salesRevenue.set(record.sku, (salesRevenue.get(record.sku) ?? 0) + revenue);
        salesUnitsForRevenue.set(record.sku, (salesUnitsForRevenue.get(record.sku) ?? 0) + quantity);
      }
    }

    const stockHistory = new Map<string, Array<{ date: Day; quantity: number }>>();
    const stockBySkuDay = new Map<string, Map<Day, number>>();
    let historicalNegativeStockRecords = 0;
    for (const record of stockRows) {
      const date = day(record.data);
      if (date !== null && date >= historyStart && date <= reference) {
        const quantity = number(record, "estoque_disponivel");
        if (quantity < 0) historicalNegativeStockRecords += 1;
        if (!stockHistory.has(record.sku)) stockHistory.set(record.sku, []);
        stockHistory.get(record.sku)!.push({ date, quantity });
        if (!stockBySkuDay.has(record.sku)) stockBySkuDay.set(record.sku, new Map());
        stockBySkuDay.get(record.sku)!.set(date, quantity);
      }
    }
    const latestStock = new Map<string, { date: Day; quantity: number }>();
    for (const [sku, history] of stockHistory) {
      latestStock.set(sku, history.reduce((latest, item) => item.date > latest.date ? item : latest));
    }
    const negativeLatestStockSkuCount = Array.from(latestStock.values()).filter((item) => item.quantity < 0).length;
    historicalNegativeStockRecords -= negativeLatestStockSkuCount;

    const leadTimes = new Map<string, number[]>();
    for (const record of purchaseRows) {
      const ordered = day(record.data_pedido);
      const received = day(record.data_recebimento);
      if (ordered !== null && received !== null && received >= ordered) {
        if (!leadTimes.has(record.sku)) leadTimes.set(record.sku, []);
        leadTimes.get(record.sku)!.push(received - ordered);
      }
    }
    const supplierLeadTimes = new Map<string, number[]>();
    for (const [sku, values] of leadTimes) {
      const supplier = catalog.get(sku)?.fornecedor;
      if (supplier) supplierLeadTimes.set(supplier, [...(supplierLeadTimes.get(supplier) ?? []), ...values]);
    }
    const openPurchases = new Map<string, Array<{ ordered: Day; quantity: number }>>();
    for (const record of purchaseRows) {
      const ordered = day(record.data_pedido);
      if (!record.data_recebimento && ordered !== null && ordered <= reference) {
        if (!openPurchases.has(record.sku)) openPurchases.set(record.sku, []);
        openPurchases.get(record.sku)!.push({
          ordered,
          quantity: number(record, "quantidade") * unitFactor(record.unidade),
        });
      }
    }

    const daily = new Map<string, { base: number; sd: number; avg28: number; avg90: number }>();
    const seasonal = new Map<string, { bf: number; christmas: number }>();
    for (const sku of catalog.keys()) {
      const history = sales.get(sku) ?? new Map<Day, number>();
      const avgWindow = (start: Day, end: Day) => {
        let total = 0;
        for (const [date, quantity] of history) if (date >= start && date <= end) total += quantity;
        return total / Math.max(end - start + 1, 1);
      };
      const avg28 = avgWindow(reference - 27, reference);
      const avg90 = avgWindow(reference - 89, reference);
      const avg180 = avgWindow(reference - 179, reference);
      const base = Math.max(0, 0.5 * avg28 + 0.3 * avg90 + 0.2 * avg180);
      const bf = avgWindow(day(shiftYear(this.parameters.blackFridayStart, -1))!, day(shiftYear(this.parameters.blackFridayEnd, -1))!);
      const christmas = avgWindow(day(shiftYear(this.parameters.christmasStart, -1))!, day(shiftYear(this.parameters.christmasEnd, -1))!);
      const values = Array.from({ length: 28 }, (_, index) => history.get(reference - 27 + index) ?? 0);
      const mean = sum(values) / values.length;
      const sd = Math.sqrt(sum(values.map((value) => (value - mean) ** 2)) / values.length);
      daily.set(sku, { base, sd, avg28, avg90 });
      seasonal.set(sku, {
        bf: base > 0 && bf > 0 ? Math.min(3, Math.max(1, bf / base)) : 1,
        christmas: base > 0 && christmas > 0 ? Math.min(3, Math.max(1, christmas / base)) : 1,
      });
    }

    const products: ProductPlan[] = [];
    const lastSaleDates = new Map<string, Day>();
    for (const [sku, product] of catalog) {
      const lastSale = Array.from(sales.get(sku)?.entries() ?? []).filter(([, quantity]) => quantity > 0)
        .reduce<number | null>((latest, [date]) => latest === null || date > latest ? date : latest, null);
      if (lastSale !== null) lastSaleDates.set(sku, lastSale);
      const currentStock = latestStock.get(sku) ?? { date: reference, quantity: 0 };
      const trend = daily.get(sku)!;
      const promo = seasonal.get(sku)!;
      const rate = product.status === "ativo" ? trend.base : 0;
      const supplier = product.fornecedor;
      const leadTime = Math.min(120, Math.max(1, percentile(
        leadTimes.get(sku) ?? [], 0.75,
        percentile(supplierLeadTimes.get(supplier) ?? [], 0.75, 30),
      )));
      const safety = rate > 0 ? zValue * trend.sd * Math.sqrt(leadTime) : 0;
      const reorderPoint = rate * leadTime + safety;
      const cover = rate > 0 ? currentStock.quantity / rate : 999;
      let expected = rate * planDays;
      const blackFridayDays = day(this.parameters.blackFridayEnd)! - day(this.parameters.blackFridayStart)! + 1;
      const christmasDays = day(this.parameters.christmasEnd)! - day(this.parameters.christmasStart)! + 1;
      expected += rate * blackFridayDays * Math.max(0, promo.bf - 1);
      expected += rate * christmasDays * Math.max(0, promo.christmas - 1);
      const inboundEvents = (openPurchases.get(sku) ?? [])
        .map((purchase) => ({ date: purchase.ordered + leadTime, quantity: purchase.quantity }))
        .filter((purchase) => purchase.date > reference && purchase.date <= planEnd)
        .sort((a, b) => a.date - b.date);
      const openInbound = sum(inboundEvents.map((purchase) => purchase.quantity));
      const inboundArrivalDate = inboundEvents.length ? dayString(inboundEvents[0].date) : null;
      const target = Math.max(0, expected + safety - currentStock.quantity - openInbound);
      const factor = unitFactor(product.unidade_compra);
      const moq = Math.max(1, Math.trunc(number(product, "moq")));
      const moqUnits = moq * factor;
      const wanted = target > 0 ? Math.ceil(target / moqUnits) * moqUnits : 0;
      const unitCost = number(product, "custo_unitario");
      const unitPrice = number(product, "preco_venda");
      const urgency = Math.max(0, reorderPoint - currentStock.quantity - openInbound) / Math.max(reorderPoint, 1);
      const lostMargin = Math.max(0, unitPrice - unitCost) * rate * Math.min(30, Math.max(0, leadTime - cover));
      const score = urgency * 65 + Math.min(rate, 100) * 0.2 + Math.min(lostMargin / 1000, 20);
      const projectedStockout = projectedDaysToStockout(currentStock.quantity, rate, reference, planStart, inboundEvents, planDays);
      const daysToStockout = projectedStockout;
      const daysUntilOrderDeadline = projectedStockout ?? (rate > 0 ? Math.max(0, Math.trunc(cover)) : null);
      const orderBy = daysUntilOrderDeadline !== null
        ? dayString(reference + Math.max(0, daysUntilOrderDeadline - Math.trunc(leadTime)))
        : null;
      products.push({
        sku, brand: product.marca, description: product.descricao, category: product.categoria,
        status: product.status, supplier: supplierNames[supplier] ?? supplier, supplierCode: supplier,
        stock: currentStock.quantity, stockDate: dayString(currentStock.date), inbound: openInbound, inboundArrivalDate,
        dailyDemand: Number(rate.toFixed(2)), avg28: Number(trend.avg28.toFixed(2)),
        coverDays: cover < 998 ? Number(cover.toFixed(1)) : null, leadTime: round(leadTime),
        reorderPoint: round(reorderPoint), safetyStock: round(safety), forecast90: round(expected),
        unitCost, unitPrice, moq, purchaseUnit: product.unidade_compra, unitFactor: factor,
        moqUnits, wanted, targetCost: Number((wanted * unitCost).toFixed(2)),
        urgency: Number(urgency.toFixed(3)), score: Number(score.toFixed(2)), daysToStockout,
        orderBy, seasonal: { blackFriday: Number(promo.bf.toFixed(2)), christmas: Number(promo.christmas.toFixed(2)) },
        buyQty: 0, buyLots: 0, buyCost: 0, unfundedQty: wanted, investment: 0, risk: "Saudável",
      });
    }

    let remaining = this.parameters.budget;
    const ranked = [...products].sort((a, b) => Number(active(b)) - Number(active(a)) || b.score - a.score);
    for (const item of ranked) {
      if (!active(item) || !item.wanted || item.unitCost <= 0) continue;
      const affordableLots = Math.floor(remaining / (item.moqUnits * item.unitCost));
      const wantedLots = Math.floor(item.wanted / item.moqUnits);
      const lots = Math.min(affordableLots, wantedLots);
      item.buyLots = lots;
      item.buyQty = lots * item.moqUnits;
      item.buyCost = Number((item.buyQty * item.unitCost).toFixed(2));
      item.unfundedQty = Math.max(0, item.wanted - item.buyQty);
      remaining = Math.max(0, remaining - item.buyCost);
    }
    for (const item of products) {
      item.investment = Number((Math.max(0, item.stock) * item.unitCost).toFixed(2));
      item.risk = active(item) && item.daysToStockout !== null && item.daysToStockout <= item.leadTime
        ? "Ruptura"
        : active(item) && item.daysToStockout !== null && item.daysToStockout < 30 ? "Atenção" : "Saudável";
    }
    products.sort((a, b) => Number(active(b)) - Number(active(a)) || b.score - a.score);
    const activeProducts = products.filter(active);
    const stockout = activeProducts.filter((item) => item.risk === "Ruptura");
    const dead = products.filter((item) => item.stock > 0 && (item.status !== "ativo" || item.dailyDemand < 0.05));
    const plannedSpend = sum(products.map((item) => item.buyCost));
    const inventoryValue = sum(products.map((item) => item.investment));
    const stockDates = Array.from(latestStock.values(), (item) => item.date);
    const latestStockDate = stockDates.length ? dayString(Math.max(...stockDates)) : this.parameters.referenceDate;
    const staleStockSkuCount = products.filter((item) => item.stockDate < this.parameters.referenceDate).length;
    const summary = {
      referenceDate: this.parameters.referenceDate, latestStockDate, staleStockSkuCount,
      duplicateSalesRowsIgnored, historicalNegativeStockRecords, negativeLatestStockSkuCount,
      planStart: this.parameters.planStart, planEnd: this.parameters.planEnd, horizonDays: planDays,
      budget: this.parameters.budget, plannedSpend: Number(plannedSpend.toFixed(2)),
      budgetRemaining: Number((this.parameters.budget - plannedSpend).toFixed(2)),
      inventoryValue: Number(inventoryValue.toFixed(2)),
      monthlyHoldingCost: Number((inventoryValue * (this.parameters.annualCapitalCostRate / 12 + this.parameters.monthlyStorageCostRate)).toFixed(2)),
      unitsOnHand: sum(products.map((item) => item.stock)), activeSkus: activeProducts.length,
      skuCount: products.length, stockoutRiskCount: stockout.length,
      slowMovingValue: Number(sum(dead.map((item) => item.investment)).toFixed(2)),
      purchaseLines: products.filter((item) => item.buyQty > 0).length,
      avgServiceLevelTarget: this.parameters.serviceLevel,
      salesWindow: `${this.parameters.historyStart.split("-").reverse().join("/")} a ${this.parameters.referenceDate.split("-").reverse().join("/")}`,
      leadTimeCoverage: "P75 por SKU; fallback P75 do fornecedor",
    };
    const capital = [...products].filter((item) => item.stock > 0).sort((a, b) => b.investment - a.investment).slice(0, 5);
    const lostSalesStart = Math.max(historyStart, reference - 179);
    let estimatedLostUnits = 0;
    let estimatedLostRevenue = 0;
    let stockoutDays = 0;
    for (const [sku, history] of stockHistory) {
      const skuStock = stockBySkuDay.get(sku)!;
      const skuSales = sales.get(sku) ?? new Map<Day, number>();
      const revenuePerUnit = (salesRevenue.get(sku) ?? 0) / Math.max(1, salesUnitsForRevenue.get(sku) ?? 0);
      for (const item of history) {
        if (item.date < lostSalesStart || item.date > reference || item.quantity > 0) continue;
        let observedDemand = 0;
        let availableDays = 0;
        for (let offset = 1; offset <= 28; offset += 1) {
          const previousDay = item.date - offset;
          if ((skuStock.get(previousDay) ?? 0) > 0) {
            observedDemand += skuSales.get(previousDay) ?? 0;
            availableDays += 1;
          }
        }
        if (!availableDays) continue;
        const lost = observedDemand / availableDays;
        estimatedLostUnits += lost;
        estimatedLostRevenue += lost * revenuePerUnit;
        stockoutDays += 1;
      }
    }
    const slowStock = [...products]
      .filter((item) => item.stock > 0 && (item.status !== "ativo" || item.dailyDemand < 0.1))
      .sort((a, b) => b.investment - a.investment)
      .slice(0, 6)
      .map((product) => ({
        product,
        lastSaleDate: lastSaleDates.has(product.sku) ? dayString(lastSaleDates.get(product.sku)!) : null,
        action: product.status !== "ativo"
          ? `Bloquear reposição; liquidar gradualmente com desconto de até ${Math.round(this.parameters.maxLiquidationDiscount * 100)}% ou kit.`
          : !lastSaleDates.has(product.sku) || lastSaleDates.get(product.sku)! < reference - 180
            ? `Suspender novas compras; testar kit ou liquidação com desconto de até ${Math.round(this.parameters.maxLiquidationDiscount * 100)}%.`
            : "Reduzir compras e testar promoção segmentada antes de liquidar.",
      }));
    const requestedInvestment = sum(products.map((item) => item.targetCost));
    const unfundedLines = products.filter((item) => item.unfundedQty > 0).length;
    return {
      summary,
      products,
      topRisks: stockout.sort((a, b) => b.score - a.score).slice(0, 8),
      suppliers: supplierNames,
      insights: {
        topCapitalProducts: capital,
        estimatedStockoutLoss: {
          units: round(estimatedLostUnits),
          revenue: Number(estimatedLostRevenue.toFixed(2)),
          stockoutSkuDays: stockoutDays,
          period: `${dayString(lostSalesStart)} a ${this.parameters.referenceDate}`,
        },
        slowStockActions: slowStock,
        budgetServiceTradeoff: {
          requestedInvestment: Number(requestedInvestment.toFixed(2)),
          fundedInvestment: Number(plannedSpend.toFixed(2)),
          unfundedInvestment: Number(Math.max(0, requestedInvestment - plannedSpend).toFixed(2)),
          fundedLines: products.filter((item) => item.buyQty > 0).length,
          unfundedLines,
        },
      },
    };
  }
}
