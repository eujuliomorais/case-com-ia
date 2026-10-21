import type { AgentResult, InventoryPlan, ProductPlan } from "../models/inventory.js";

function currency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function date(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function fallbackMessage(plan: InventoryPlan): string {
  const summary = plan.summary;
  const urgent = plan.topRisks.slice(0, 3).map((item) =>
    `${item.sku} (${item.coverDays} dias de cobertura para lead time de ${item.leadTime} dias)`,
  ).join(", ") || "nenhum SKU ativo abaixo do lead time estimado";
  return `Plano de compras calculado para ${date(summary.planStart)} a ${date(summary.planEnd)}: ${currency(summary.plannedSpend)} de ${currency(summary.budget)}, com ${summary.purchaseLines} linhas de compra e ${currency(summary.budgetRemaining)} de orçamento livre. Priorize a revisão de ${urgent}. O plano considera demanda recente, sazonalidade observada, estoque de segurança para ${summary.avgServiceLevelTarget}% e MOQ. Ação para hoje: valide disponibilidade e prazo dos fornecedores dos itens em risco antes de emitir os pedidos.`;
}

function selectedProduct(product: ProductPlan) {
  return {
    sku: product.sku,
    product: product.description,
    risk: product.risk,
    stock: product.stock,
    cover_days: product.coverDays,
    lead_time_days: product.leadTime,
    days_to_stockout: product.daysToStockout,
    order_by: product.orderBy,
    daily_demand: product.dailyDemand,
    recommended_purchase_units: product.buyQty,
    incoming_units_estimated_in_horizon: product.inbound,
    estimated_inbound_date: product.inboundArrivalDate,
    unfunded_units: product.unfundedQty,
    investment_brl: product.buyCost,
    supplier: product.supplier,
  };
}

export class AgentService {
  async createNarrative(plan: InventoryPlan): Promise<AgentResult> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) return { mode: "rules", model: null, message: fallbackMessage(plan), keyConfigured: false };

    const model = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    const selected = plan.products.filter((product) => product.buyQty > 0).slice(0, 18);
    const payload = {
      data: plan.summary,
      priority_skus: selected.map(selectedProduct),
      top_stockout_risks: plan.topRisks.slice(0, 5).map((product) => ({
        sku: product.sku,
        cover_days: product.coverDays,
        lead_time_days: product.leadTime,
        daily_demand: product.dailyDemand,
      })),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1200,
          messages: [
            {
              role: "system",
              content: "Você é o agente de decisão de estoque do e-commerce GoBeauté. Sua tarefa é priorizar as linhas de compra calculadas e produzir um plano de ação que ajude o time a decidir o que validar hoje. Use somente os dados recebidos. Não altere nem invente quantidades, valores, SKUs, fornecedores ou datas; a compra é apenas uma recomendação sujeita à aprovação humana. Priorize risco de ruptura (cobertura versus lead time), depois urgência/data de pedido e unidades sem cobertura orçamentária. Quando houver data de recebimento estimada, identifique-a como estimativa baseada no lead time histórico. Retorne somente JSON válido com exatamente as propriedades: {\"message\": string, \"priority_skus\": string[]}. Em message, escreva em português do Brasil: decisão de alocação e valor, até 5 prioridades com justificativa objetiva usando os números recebidos, riscos/caveats e uma ação concreta para hoje; deixe claro que previsão não garante venda e que pedidos dependem de validação humana. priority_skus deve conter até 6 SKUs exatos, sem duplicatas, escolhidos somente de priority_skus do usuário e em ordem de prioridade. Se não houver linhas de compra, retorne uma lista vazia e recomende revisar cobertura e estoque parado.",
            },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) throw new Error(`Groq respondeu com status ${response.status}`);
      const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new Error("Resposta vazia da Groq");
      const parsed = JSON.parse(content) as { message?: unknown; priority_skus?: unknown };
      if (typeof parsed.message !== "string" || !Array.isArray(parsed.priority_skus)) {
        throw new Error("Resposta da Groq fora do formato esperado");
      }
      const allowedSkus = new Set(selected.map((product) => product.sku));
      const prioritySkus = [...new Set(parsed.priority_skus.filter(
        (sku): sku is string => typeof sku === "string" && allowedSkus.has(sku),
      ))].slice(0, 6);
      if (selected.length > 0 && prioritySkus.length === 0) {
        throw new Error("A Groq não retornou prioridades válidas");
      }
      return { mode: "ai", model, message: parsed.message, keyConfigured: true, prioritySkus };
    } catch {
      return {
        mode: "rules", model: null, message: fallbackMessage(plan), keyConfigured: true,
        error: "Não foi possível consultar a IA agora; exibindo plano calculado localmente.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
