interface SidebarProps {
  purchaseCount: number | null;
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
}

export type DashboardTab = "overview" | "purchases" | "risks" | "capital";

export function Sidebar({ purchaseCount, activeTab, onSelectTab }: SidebarProps) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="GoBeauté estoque">
        <span className="brand-mark">g</span><span className="brand-name">go<span>beauté</span></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Navegação principal">
        <button className={`nav-item${activeTab === "overview" ? " active" : ""}`} onClick={() => onSelectTab("overview")} aria-current={activeTab === "overview" ? "page" : undefined}><span className="icon">◫</span>Visão geral</button>
        <button className={`nav-item${activeTab === "purchases" ? " active" : ""}`} onClick={() => onSelectTab("purchases")} aria-current={activeTab === "purchases" ? "page" : undefined}><span className="icon">↗</span>Plano de compras<span className="nav-count">{purchaseCount ?? "—"}</span></button>
        <button className={`nav-item${activeTab === "risks" ? " active" : ""}`} onClick={() => onSelectTab("risks")} aria-current={activeTab === "risks" ? "page" : undefined}><span className="icon">◉</span>Risco de ruptura</button>
        <button className={`nav-item${activeTab === "capital" ? " active" : ""}`} onClick={() => onSelectTab("capital")} aria-current={activeTab === "capital" ? "page" : undefined}><span className="icon">◇</span>Capital e baixo giro</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="advisor-card"><span className="advisor-spark">✳</span><strong>Decisões melhores,<br />com dados.</strong><p>Planejamento inteligente para o seu estoque.</p></div>
        <div className="sidebar-user"><div className="avatar">GB</div><div><strong>GoBeauté</strong><small>Planejamento</small></div><span className="more">···</span></div>
      </div>
    </aside>
  );
}
