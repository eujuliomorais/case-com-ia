export type Risk = "Ruptura" | "Atenção" | "Saudável";

export interface Product {
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

export interface Summary {
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

export interface DashboardData {
  summary: Summary;
  products: Product[];
  topRisks: Product[];
  suppliers: Record<string, string>;
  insights: {
    topCapitalProducts: Product[];
    estimatedStockoutLoss: { units: number; revenue: number; stockoutSkuDays: number; period: string };
    slowStockActions: Array<{ product: Product; action: string; lastSaleDate: string | null }>;
    budgetServiceTradeoff: { requestedInvestment: number; fundedInvestment: number; unfundedInvestment: number; fundedLines: number; unfundedLines: number };
  };
}

export interface AgentResponse {
  agent: { mode: "ai" | "rules"; model: string | null; message: string; keyConfigured: boolean; error?: string };
  summary: Summary;
  priorities: Product[];
}
