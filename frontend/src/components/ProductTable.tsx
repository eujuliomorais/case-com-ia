import { useMemo, useState } from "react";
import type { Product, Risk } from "../types";
import { money, number } from "../lib/format";

interface ProductTableProps {
  products: Product[];
  onGeneratePlan: () => void;
  isGeneratingPlan: boolean;
  title?: string;
  description?: string;
  showAgentAction?: boolean;
}

function riskClass(product: Product) {
  return product.risk === "Ruptura" ? "critical" : product.risk === "Atenção" ? "attention" : "";
}

export function ProductTable({ products, onGeneratePlan, isGeneratingPlan, title = "Plano de compras", description = "Prioridades calculadas com demanda, sazonalidade, lead time e MOQ.", showAgentAction = true }: ProductTableProps) {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<Risk | "">("");
  const [buy, setBuy] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const filtered = useMemo(() => products.filter((product) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const matchesTerm = !term || `${product.sku} ${product.description} ${product.brand}`.toLocaleLowerCase("pt-BR").includes(term);
    return matchesTerm && (!risk || product.risk === risk) && (!buy || (buy === "buy" ? product.buyQty > 0 : product.buyQty === 0));
  }), [products, search, risk, buy]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  return <section id="purchases" className="panel table-panel">
    <div className="panel-heading table-heading">
      <div><div className="eyebrow">AÇÃO RECOMENDADA</div><h2>{title}</h2><p>{description}</p></div>
      {showAgentAction && <button className="primary-button" onClick={onGeneratePlan} disabled={isGeneratingPlan}><span>✳</span> {isGeneratingPlan ? "Gerando plano…" : "Gerar plano com IA"}</button>}
    </div>
    <div className="toolbar">
      <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Buscar SKU ou produto" aria-label="Buscar SKU ou produto" /></label>
      <div className="filters">
        <select value={risk} onChange={(event) => updateFilter(setRisk, event.target.value as Risk | "")} aria-label="Filtrar por risco">
          <option value="">Todos os riscos</option><option value="Ruptura">Ruptura</option><option value="Atenção">Atenção</option><option value="Saudável">Saudável</option>
        </select>
        <select value={buy} onChange={(event) => updateFilter(setBuy, event.target.value)} aria-label="Filtrar plano de compras">
          <option value="">Todas as recomendações</option><option value="buy">Com compra recomendada</option><option value="no-buy">Sem compra</option>
        </select>
      </div>
      <span className="result-count">{number(filtered.length)} SKUs</span>
    </div>
    <div className="table-wrap"><table><thead><tr><th>PRODUTO</th><th>COBERTURA</th><th>ESTOQUE</th><th>LEAD TIME</th><th>COMPRA SUGERIDA</th><th>PEDIR ATÉ</th><th>INVESTIMENTO</th><th>PRIORIDADE</th></tr></thead>
      <tbody>{visible.length ? visible.map((product) => <tr key={product.sku}>
        <td><div className="product-cell"><span className="product-avatar">{product.brand.slice(0, 2).toUpperCase()}</span><div><div className="product-name" title={product.description}>{product.description}</div><div className="product-meta">{product.sku} · {product.brand}</div></div></div></td>
        <td><span className={`coverage ${riskClass(product)}`}>{product.coverDays === null ? "Sem giro" : `${number(product.coverDays)} dias`}</span></td>
        <td>{number(product.stock)} <em className="buy-unit">un</em>{product.inbound > 0 && <div className="buy-unit">+ {number(product.inbound)} un em compras abertas · chegada estimada {product.inboundArrivalDate ? new Date(`${product.inboundArrivalDate}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</div>}</td><td>{number(product.leadTime)} dias</td>
        <td><span className="buy-qty">{product.buyQty ? `${number(product.buyQty)} un` : product.wanted ? "Sem verba" : "Sem compra"}</span>{product.buyQty > 0 && <div className="buy-unit">{number(product.buyLots)} lote(s) · MOQ {number(product.moq)} {product.purchaseUnit}</div>}{product.unfundedQty > 0 && <div className="buy-unit">Necessário: {number(product.wanted)} un; faltam {number(product.unfundedQty)} un</div>}</td>
        <td>{product.orderBy ? new Date(`${product.orderBy}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
        <td>{product.buyQty ? money(product.buyCost) : "—"}</td><td><span className={`risk-chip ${product.risk}`}>{product.risk}</span></td>
      </tr>) : <tr><td colSpan={8} className="loading">Nenhum produto corresponde aos filtros.</td></tr>}</tbody>
    </table></div>
    <div className="table-footer"><span>{filtered.length ? `Mostrando ${start + 1}–${Math.min(start + pageSize, filtered.length)} de ${number(filtered.length)} itens` : "Nenhum SKU encontrado"}</span><div>
      <button className="page-button" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage} / {pageCount}</span>
      <button className="page-button" aria-label="Próxima página" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
    </div></div>
  </section>;
}
