export type Risk = "Ruptura" | "Atenção" | "Saudável";

export interface ProductPlan {
  sku: string;
  brand: string;
  description: string;
  category: string;
  status: string;
  supplier: string;
  supplierCode: string;
  stock: number;
  stockDate: string;
  inbound: number;
  inboundArrivalDate: string | null;
  dailyDemand: number;
  avg28: number;
  coverDays: number | null;
  leadTime: number;
  reorderPoint: number;
  safetyStock: number;
  forecast90: number;
  unitCost: number;
  unitPrice: number;
  moq: number;
  purchaseUnit: string;
  unitFactor: number;
  moqUnits: number;
  wanted: number;
  targetCost: number;
  urgency: number;
  score: number;
  daysToStockout: number | null;
  orderBy: string | null;
  seasonal: { blackFriday: number; christmas: number };
  buyQty: number;
  buyLots: number;
  buyCost: number;
  unfundedQty: number;
  investment: number;
  risk: Risk;
}

export interface InventorySummary {
  referenceDate: string;
  latestStockDate: string;
  staleStockSkuCount: number;
  duplicateSalesRowsIgnored: number;
  historicalNegativeStockRecords: number;
  negativeLatestStockSkuCount: number;
  planStart: string;
  planEnd: string;
  horizonDays: number;
  budget: number;
  plannedSpend: number;
  budgetRemaining: number;
  inventoryValue: number;
  monthlyHoldingCost: number;
  unitsOnHand: number;
  activeSkus: number;
  skuCount: number;
  stockoutRiskCount: number;
  slowMovingValue: number;
  purchaseLines: number;
  avgServiceLevelTarget: number;
  salesWindow: string;
  leadTimeCoverage: string;
}

export interface InventoryPlan {
  summary: InventorySummary;
  products: ProductPlan[];
  topRisks: ProductPlan[];
  suppliers: Record<string, string>;
  insights: {
    topCapitalProducts: ProductPlan[];
    estimatedStockoutLoss: { units: number; revenue: number; stockoutSkuDays: number; period: string };
    slowStockActions: Array<{ product: ProductPlan; action: string; lastSaleDate: string | null }>;
    budgetServiceTradeoff: { requestedInvestment: number; fundedInvestment: number; unfundedInvestment: number; fundedLines: number; unfundedLines: number };
  };
}

export interface AgentResult {
  mode: "ai" | "rules";
  model: string | null;
  message: string;
  keyConfigured: boolean;
  prioritySkus?: string[];
  error?: string;
}
