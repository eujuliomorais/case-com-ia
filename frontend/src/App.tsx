import { useCallback, useEffect, useState } from "react";
import { AgentDrawer } from "./components/AgentDrawer";
import { DataQualityNotice } from "./components/DataQualityNotice";
import { Header } from "./components/Header";
import { BudgetPanel, HealthPanel } from "./components/InsightsPanels";
import { InventoryInsights } from "./components/InventoryInsights";
import { MetricsGrid } from "./components/MetricsGrid";
import { ProductTable } from "./components/ProductTable";
import { Sidebar, type DashboardTab } from "./components/Sidebar";
import { generatePlan, getDashboard } from "./services/inventoryApi";
import type { AgentResponse, DashboardData } from "./types";

function formatDate(value: string | undefined): string {
  return value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—";
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const pageTitles: Record<DashboardTab, string> = {
    overview: "Visão geral",
    purchases: "Plano de compras",
    risks: "Risco de ruptura",
    capital: "Capital e baixo giro",
  };

  useEffect(() => {
    getDashboard()
      .then(setDashboard)
      .catch((error: Error) => setDashboardError(error.message));
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  async function handleGeneratePlan() {
    setDrawerOpen(true);
    setAgentLoading(true);
    setAgentResult(null);
    setAgentError(null);
    try {
      setAgentResult(await generatePlan());
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Falha ao gerar plano.");
    } finally {
      setAgentLoading(false);
    }
  }

  return <div className="app-shell">
    <Sidebar purchaseCount={dashboard?.summary.purchaseLines ?? null} activeTab={activeTab} onSelectTab={setActiveTab} />
    <main id="top" className="main-content">
      <Header summary={dashboard?.summary ?? null} currentPage={pageTitles[activeTab]} />
      <section id="dashboard" className="page-heading">
        <div><div className="eyebrow">GO BEAUTÉ · E-COMMERCE</div><h1>Inteligência de estoque</h1><p>Visibilidade para decidir o que comprar, quando e em qual quantidade.</p></div>
        <div className="heading-right"><span className="date-chip"><span>◷</span> Plano de {dashboard?.summary.horizonDays ?? 90} dias <b>{formatDate(dashboard?.summary.planStart)} — {formatDate(dashboard?.summary.planEnd)}</b></span></div>
      </section>
      {dashboard ? <>
        <DataQualityNotice summary={dashboard.summary} />
        {activeTab === "overview" && <>
          <MetricsGrid summary={dashboard.summary} />
          <section className="content-grid"><BudgetPanel summary={dashboard.summary} tradeoff={dashboard.insights.budgetServiceTradeoff} /><HealthPanel products={dashboard.products} loss={dashboard.insights.estimatedStockoutLoss} /></section>
        </>}
        {activeTab === "purchases" && <ProductTable products={dashboard.products} onGeneratePlan={handleGeneratePlan} isGeneratingPlan={agentLoading} />}
        {activeTab === "risks" && <>
          <HealthPanel products={dashboard.products} loss={dashboard.insights.estimatedStockoutLoss} />
          <ProductTable products={dashboard.products.filter((product) => product.risk !== "Saudável")} onGeneratePlan={handleGeneratePlan} isGeneratingPlan={agentLoading} showAgentAction={false} title="SKUs que exigem atenção" description="Produtos em ruptura ou com cobertura estimada inferior a 30 dias." />
        </>}
        {activeTab === "capital" && <InventoryInsights data={dashboard} />}
      </> : <section className="panel loading-state">{dashboardError ? <div className="error-state">Não foi possível carregar os dados: {dashboardError}. Confira se os CSVs foram fornecidos no servidor.</div> : "Carregando dados de estoque…"}</section>}
      <footer className="footer"><span>GoBeauté · Planejamento de estoque</span><span>Demanda estimada com histórico até 29 set, 2026</span></footer>
    </main>
    <AgentDrawer open={drawerOpen} loading={agentLoading} result={agentResult} error={agentError} onClose={closeDrawer} />
  </div>;
}
