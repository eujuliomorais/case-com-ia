import type { Summary } from "../types";
import { money, number } from "../lib/format";

export function MetricsGrid({ summary }: { summary: Summary }) {
  const cards = [
    { title: "Capital em estoque", value: money(summary.inventoryValue), icon: "◇", tone: "purple", footer: <><span className="dot purple-dot" />{number(summary.unitsOnHand)} unidades disponíveis</> },
    { title: "SKUs em risco de ruptura", value: number(summary.stockoutRiskCount), icon: "↗", tone: "orange", footer: <><span className="status-pill danger">Abaixo do lead time</span><span>estoque atual</span></> },
    { title: "Plano recomendado", value: money(summary.plannedSpend), icon: "▤", tone: "green", footer: <>{number(summary.purchaseLines)} SKUs · janela de 90 dias</> },
    { title: "Capital em baixo giro", value: money(summary.slowMovingValue), icon: "⌁", tone: "blue", footer: <>Itens sem giro e descontinuados</> },
  ];
  return <section className="kpi-grid" aria-label="Indicadores principais">
    {cards.map((card) => <article className="kpi-card" key={card.title}>
      <div className="kpi-top"><span>{card.title}</span><span className={`kpi-icon ${card.tone}`}>{card.icon}</span></div>
      <strong className="kpi-value">{card.value}</strong><div className="kpi-foot">{card.footer}</div>
    </article>)}
  </section>;
}
