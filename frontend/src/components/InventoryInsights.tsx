import type { DashboardData } from "../types";
import { money, number } from "../lib/format";

export function InventoryInsights({ data }: { data: DashboardData }) {
  const { insights, summary } = data;

  return <section className="portfolio-insights" id="portfolio-insights" aria-label="Capital em estoque e ações de baixo giro">
    <article className="panel capital-panel">
      <div className="panel-heading"><div><h2>Maior capital por SKU</h2><p>Estoque atual valorizado a custo · {summary.latestStockDate}</p></div></div>
      <div className="capital-list">{insights.topCapitalProducts.map((product, index) => {
        const share = summary.inventoryValue > 0 ? product.investment / summary.inventoryValue * 100 : 0;
        return <div className="capital-item" key={product.sku}>
          <span className="capital-rank">{index + 1}</span>
          <div className="capital-product"><strong title={product.description}>{product.description}</strong><small>{product.sku} · {number(product.stock)} un · {product.coverDays === null ? "sem giro" : `${number(product.coverDays)} dias de cobertura`}</small>
            <div className="capital-track"><span style={{ width: `${Math.min(100, share)}%` }} /></div>
          </div>
          <b className="capital-value">{money(product.investment)}</b>
        </div>;
      })}</div>
    </article>

    <article className="panel slowstock-panel">
      <div className="panel-heading"><div><h2>Baixo giro e descontinuados</h2><p>Ações para reduzir estoque parado sem repor itens descontinuados</p></div></div>
      {insights.slowStockActions.length ? <div className="slowstock-list">{insights.slowStockActions.map(({ product, action, lastSaleDate }) =>
        <div className="slowstock-item" key={product.sku}>
          <div className="slowstock-item-heading"><strong title={product.description}>{product.description}</strong><span>{money(product.investment)}</span></div>
          <small>{product.sku} · {number(product.stock)} un · última venda {lastSaleDate ? new Date(`${lastSaleDate}T00:00:00`).toLocaleDateString("pt-BR") : "sem registro"}</small>
          <p>{action}</p>
        </div>,
      )}</div> : <p className="insights-empty">Nenhum SKU com estoque parado pelos critérios atuais de giro.</p>}
    </article>
  </section>;
}
