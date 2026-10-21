import type { DashboardData, Product, Summary } from "../types";
import { money, number } from "../lib/format";

export function BudgetPanel({ summary, tradeoff }: { summary: Summary; tradeoff: DashboardData["insights"]["budgetServiceTradeoff"] }) {
  const progress = Math.min(100, summary.plannedSpend / summary.budget * 100);
  const needCoverage = tradeoff.requestedInvestment > 0
    ? Math.min(100, tradeoff.fundedInvestment / tradeoff.requestedInvestment * 100)
    : 100;
  return <article className="panel budget-panel">
    <div className="panel-heading"><div><h2>Orçamento de compras</h2><p>Alocação recomendada para os próximos 90 dias</p></div></div>
    <div className="budget-numbers"><div><span>Investimento planejado</span><strong>{money(summary.plannedSpend)}</strong></div><div className="budget-remaining"><span>Disponível</span><strong>{money(summary.budgetRemaining)}</strong></div></div>
    <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
    <div className="budget-caption"><span>R$ 0</span><span>Orçamento total {money(summary.budget)}</span></div>
    <div className="budget-tradeoff">
      <div><span>Necessidade valorizada</span><strong>{money(tradeoff.requestedInvestment)}</strong></div>
      <div><span>Necessidade coberta</span><strong>{number(needCoverage)}%</strong></div>
      <div><span>Sem cobertura de caixa</span><strong>{money(tradeoff.unfundedInvestment)}</strong></div>
    </div>
    <div className="budget-note"><span className="note-icon">i</span><span>Ordem de prioridade considera urgência e risco de ruptura; a meta de serviço de {summary.avgServiceLevelTarget}% dimensiona o estoque de segurança. O resultado realizado depende da previsão e dos prazos dos fornecedores. Lotes respeitam o MOQ. Custo mensal estimado de capital e armazenagem do estoque atual: {money(summary.monthlyHoldingCost)}.</span></div>
  </article>;
}

export function HealthPanel({ products, loss }: { products: Product[]; loss: DashboardData["insights"]["estimatedStockoutLoss"] }) {
  const active = products.filter((product) => product.status === "ativo");
  const counts = {
    Ruptura: active.filter((product) => product.risk === "Ruptura").length,
    Atenção: active.filter((product) => product.risk === "Atenção").length,
    Saudável: active.filter((product) => product.risk === "Saudável").length,
  };
  const total = Math.max(active.length, 1);
  return <article className="panel risk-panel" id="risks">
    <div className="panel-heading"><div><h2>Saúde do portfólio</h2><p>SKUs ativos por cobertura estimada</p></div><span className="small-label">{number(active.length)} ativos</span></div>
    <div className="health-chart" aria-label="Distribuição estimada da cobertura de estoque"><div className="health-bar">
      <span id="bar-critical" style={{ width: `${counts.Ruptura / total * 100}%` }} />
      <span id="bar-attention" style={{ width: `${counts.Atenção / total * 100}%` }} />
      <span id="bar-healthy" style={{ width: `${counts.Saudável / total * 100}%` }} />
    </div></div>
    <div className="health-legend">
      <div><i className="legend-dot red" /><span>Crítico <b>{counts.Ruptura}</b></span><small>abaixo do lead time</small></div>
      <div><i className="legend-dot amber" /><span>Atenção <b>{counts.Atenção}</b></span><small>menos de 30 dias</small></div>
      <div><i className="legend-dot sage" /><span>Saudável <b>{counts.Saudável}</b></span><small>cobertura adequada</small></div>
    </div>
    <div className="stockout-impact">
      <div><span>Exposição estimada a ruptura · {loss.period}</span><small>{number(loss.units)} unidades potenciais em {number(loss.stockoutSkuDays)} dias-SKU sem estoque</small></div>
      <strong>{money(loss.revenue)}</strong>
      <p>Estimativa pela demanda média observada nos 28 dias anteriores com estoque positivo; não representa pedidos recusados observados.</p>
    </div>
  </article>;
}
