import type { Summary } from "../types";
import { number } from "../lib/format";

export function DataQualityNotice({ summary }: { summary: Summary }) {
  const notes: string[] = [];
  if (summary.staleStockSkuCount > 0) {
    notes.push(`${number(summary.staleStockSkuCount)} SKUs têm posição de estoque anterior a ${summary.referenceDate.split("-").reverse().join("/")}`);
  }
  if (summary.duplicateSalesRowsIgnored > 0) {
    notes.push(`${number(summary.duplicateSalesRowsIgnored)} linhas de vendas duplicadas foram descartadas`);
  }
  if (summary.historicalNegativeStockRecords > 0 || summary.negativeLatestStockSkuCount > 0) {
    notes.push(`${number(summary.historicalNegativeStockRecords)} registros históricos de estoque negativos; ${number(summary.negativeLatestStockSkuCount)} SKUs com saldo atual negativo`);
  }
  if (!notes.length) return null;
  return <aside className="data-quality-notice" role="note" aria-label="Qualidade e atualização dos dados">
    <span className="data-quality-icon" aria-hidden="true">i</span>
    <span>{notes.join(" · ")}</span>
  </aside>;
}
