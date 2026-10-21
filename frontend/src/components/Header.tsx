import type { Summary } from "../types";

interface HeaderProps {
  summary: Summary | null;
  currentPage: string;
}

export function Header({ summary, currentPage }: HeaderProps) {
  const referenceDate = summary
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${summary.latestStockDate}T12:00:00`))
    : "";
  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Estoque</span><span className="crumb-sep">/</span><strong>{currentPage}</strong></div>
      <div className="top-actions"><span className="sync-status"><i />Base de dados até {referenceDate || "—"}</span><div className="avatar top-avatar" aria-label="GoBeauté">GB</div></div>
    </header>
  );
}
