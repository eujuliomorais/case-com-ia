const productSchema = {
  type: "object",
  properties: {
    sku: { type: "string", example: "SKU-001" },
    brand: { type: "string" },
    description: { type: "string" },
    category: { type: "string" },
    status: { type: "string", example: "ativo" },
    supplier: { type: "string" },
    supplierCode: { type: "string" },
    stock: { type: "number" },
    stockDate: { type: "string", format: "date" },
    inbound: { type: "number" },
    inboundArrivalDate: { type: "string", format: "date", nullable: true, description: "Data estimada a partir do lead time P75; não é confirmação do fornecedor." },
    dailyDemand: { type: "number" },
    avg28: { type: "number" },
    coverDays: { type: "number", nullable: true },
    leadTime: { type: "number" },
    reorderPoint: { type: "number" },
    safetyStock: { type: "number" },
    forecast90: { type: "number" },
    unitCost: { type: "number" },
    unitPrice: { type: "number" },
    moq: { type: "number" },
    purchaseUnit: { type: "string" },
    unitFactor: { type: "number" },
    moqUnits: { type: "number" },
    wanted: { type: "number" },
    targetCost: { type: "number" },
    urgency: { type: "number" },
    score: { type: "number" },
    daysToStockout: { type: "number", nullable: true },
    orderBy: { type: "string", format: "date", nullable: true },
    seasonal: {
      type: "object",
      properties: { blackFriday: { type: "number" }, christmas: { type: "number" } },
    },
    buyQty: { type: "number" },
    buyLots: { type: "number" },
    buyCost: { type: "number" },
    unfundedQty: { type: "number" },
    investment: { type: "number" },
    risk: { type: "string", enum: ["Ruptura", "Atenção", "Saudável"] },
  },
};

const summarySchema = {
  type: "object",
  properties: {
    referenceDate: { type: "string", format: "date" },
    latestStockDate: { type: "string", format: "date" },
    staleStockSkuCount: { type: "integer" },
    duplicateSalesRowsIgnored: { type: "integer" },
    historicalNegativeStockRecords: { type: "integer" },
    negativeLatestStockSkuCount: { type: "integer" },
    planStart: { type: "string", format: "date" },
    planEnd: { type: "string", format: "date" },
    horizonDays: { type: "integer" },
    budget: { type: "number" },
    plannedSpend: { type: "number" },
    budgetRemaining: { type: "number" },
    inventoryValue: { type: "number" },
    monthlyHoldingCost: { type: "number" },
    unitsOnHand: { type: "number" },
    activeSkus: { type: "integer" },
    skuCount: { type: "integer" },
    stockoutRiskCount: { type: "integer" },
    slowMovingValue: { type: "number" },
    purchaseLines: { type: "integer" },
    avgServiceLevelTarget: { type: "number" },
    salesWindow: { type: "string" },
    leadTimeCoverage: { type: "string" },
  },
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "GoBeauté Inventory API",
    version: "1.0.0",
    description: "API de saúde, planejamento de estoque e prioridades de compra.",
  },
  servers: [{ url: "/", description: "Servidor da aplicação" }],
  tags: [
    { name: "Health", description: "Estado da API" },
    { name: "Inventory", description: "Dados e planejamento de estoque" },
    { name: "Agent", description: "Narrativa e prioridades geradas para o plano" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Verifica se a API está disponível",
        responses: {
          "200": {
            description: "API operacional",
            content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: true } } } } },
          },
        },
      },
    },
    "/api/dashboard": {
      get: {
        tags: ["Inventory"],
        summary: "Obtém o plano completo do dashboard",
        description: "Retorna resumo, produtos ordenados por prioridade, maiores riscos e fornecedores. O resultado fica em cache por 60 segundos.",
        responses: {
          "200": {
            description: "Plano de estoque calculado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    summary: { $ref: "#/components/schemas/InventorySummary" },
                    products: { type: "array", items: { $ref: "#/components/schemas/ProductPlan" } },
                    topRisks: { type: "array", items: { $ref: "#/components/schemas/ProductPlan" } },
                    suppliers: { type: "object", additionalProperties: { type: "string" } },
                  },
                },
              },
            },
          },
          "429": { description: "Limite temporário de geração atingido" },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/agent/plan": {
      post: {
        tags: ["Agent"],
        summary: "Gera uma narrativa para o plano de compras",
        description: "Não recebe corpo. Quando a IA está configurada, ela prioriza linhas já calculadas usando risco de ruptura, cobertura, lead time e orçamento; a API valida os SKUs e preserva quantidades. Sem IA, aplica a ordenação determinística do plano. Toda compra exige aprovação humana.",
        responses: {
          "200": {
            description: "Plano de ação e até 12 prioridades de compra, ordenadas pela IA quando disponível",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    agent: {
                      type: "object",
                      properties: {
                        mode: { type: "string", enum: ["ai", "rules"] },
                        model: { type: "string", nullable: true },
                        message: { type: "string" },
                        keyConfigured: { type: "boolean" },
                        error: { type: "string" },
                      },
                      required: ["mode", "model", "message", "keyConfigured"],
                    },
                    summary: { $ref: "#/components/schemas/InventorySummary" },
                    priorities: { type: "array", items: { $ref: "#/components/schemas/ProductPlan" }, maxItems: 12 },
                  },
                  required: ["agent", "summary", "priorities"],
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
  },
  components: {
    schemas: {
      ProductPlan: productSchema,
      InventorySummary: summarySchema,
    },
    responses: {
      ServerError: {
        description: "Erro interno ao processar a solicitação",
        content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } }, required: ["error"] } } },
      },
    },
  },
};
