import { useEffect } from "react";
import type { AgentResponse } from "../types";
import { money, number } from "../lib/format";

interface AgentDrawerProps {
  open: boolean;
  loading: boolean;
  result: AgentResponse | null;
  error: string | null;
  onClose: () => void;
}

export function AgentDrawer({ open, loading, result, error, onClose }: AgentDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const priorities = result?.priorities.filter((product) => product.buyQty > 0).slice(0, 6) ?? [];
  const agent = result?.agent;
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="agent-drawer" role="dialog" aria-modal="true" aria-labelledby="agent-title">
      <div className="agent-head"><div className="agent-title-icon">✳</div><div><span className="eyebrow">GO BEAUTÉ · COPILOTO</span><h2 id="agent-title">Plano de ação</h2></div><button onClick={onClose} className="close-button" aria-label="Fechar">×</button></div>
      <div className="agent-rule" />
      <div className="agent-content">
        {loading ? <div className="agent-loading"><span className="spinner" /><strong>Analisando seu estoque</strong><p>Priorizando compras com base em cobertura, demanda e orçamento.</p></div>
          : error ? <div className="error-state">Não foi possível gerar o plano: {error}</div>
            : result && agent ? <>
              <p className="agent-meta">{agent.mode === "ai" ? `Resposta gerada por ${agent.model}` : "Plano calculado localmente · configure a chave Groq para ativar a análise por IA"}</p>
              {agent.error && <div className="error-state">{agent.error}</div>}
              <div className="agent-summary">{agent.message}</div>
              <div className="agent-stat-grid">
                <div className="agent-stat"><small>Investimento planejado</small><strong>{money(result.summary.plannedSpend)}</strong></div>
                <div className="agent-stat"><small>Orçamento disponível</small><strong>{money(result.summary.budgetRemaining)}</strong></div>
                <div className="agent-stat"><small>Linhas de compra</small><strong>{number(result.summary.purchaseLines)} SKUs</strong></div>
                <div className="agent-stat"><small>Risco de ruptura</small><strong>{number(result.summary.stockoutRiskCount)} SKUs</strong></div>
              </div>
              <div className="agent-priorities"><h3>{agent.mode === "ai" ? "Prioridades escolhidas pelo agente" : "Prioridades calculadas"}</h3>{priorities.length ? priorities.map((product, index) => <div className="agent-priority" key={product.sku}>
                <span className="priority-no">{String(index + 1).padStart(2, "0")}</span><div><strong>{product.sku} · {product.description}</strong><small>{number(product.buyQty)} unidades · {money(product.buyCost)} · cobertura {product.coverDays === null ? "sem giro" : `${number(product.coverDays)} dias`} · prazo {number(product.leadTime)} dias</small></div>
              </div>) : <p className="agent-meta">Nenhuma compra recomendada dentro dos critérios atuais.</p>}</div>
            </> : null}
      </div>
      <div className="agent-foot"><span className="ai-badge">✳ &nbsp;AI-first inventory agent</span><p>Valide disponibilidade e prazo com o fornecedor antes de emitir pedidos.</p></div>
    </aside>
  </div>;
}
