import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface BusinessParameters {
  referenceDate: string;
  historyStart: string;
  planStart: string;
  planEnd: string;
  budget: number;
  serviceLevel: number;
  annualCapitalCostRate: number;
  monthlyStorageCostRate: number;
  maxLiquidationDiscount: number;
  blackFridayStart: string;
  blackFridayEnd: string;
  christmasStart: string;
  christmasEnd: string;
}

const date = (value: string) => {
  const [, day, month, year] = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? [];
  if (!day || !month || !year) throw new Error(`Data inválida nos parâmetros: ${value}`);
  return `${year}-${month}-${day}`;
};

function requiredMatch(source: string, expression: RegExp, label: string): RegExpMatchArray {
  const match = source.match(expression);
  if (!match) throw new Error(`Parâmetro ausente ou inválido: ${label}`);
  return match;
}

function percent(value: string): number {
  return Number(value.replace(",", ".")) / 100;
}

export function parseBusinessParameters(source: string): BusinessParameters {
  const referenceDate = date(requiredMatch(source, /Data de referência:\s*(\d{2}\/\d{2}\/\d{4})/, "Data de referência")[1]);
  const historyStart = date(requiredMatch(source, /Histórico desde\s*(\d{2}\/\d{2}\/\d{4})/, "Início do histórico")[1]);
  const budgetRow = requiredMatch(source, /\|\s*Orçamento de compras[^|]*\((\d{2}\/\d{2})(?:\/\d{4})?\s*a\s*(\d{2}\/\d{2}\/\d{4})\)[^|]*\|\s*R\$\s*([\d.]+(?:,\d+)?)\s*\|/i, "Orçamento e horizonte");
  const capitalRate = requiredMatch(source, /\|\s*Custo de capital\s*\|\s*([\d,]+)% ao ano/i, "Custo de capital")[1];
  const storageRate = requiredMatch(source, /\|\s*Custo de armazenagem\s*\|\s*([\d,]+)%[^|]*\|/i, "Custo de armazenagem")[1];
  const discountRate = requiredMatch(source, /\|\s*Desconto máximo permitido[^|]*\|\s*([\d,]+)%/i, "Desconto máximo")[1];
  const serviceRate = requiredMatch(source, /Nível de serviço desejado:\s*([\d,]+)%/i, "Nível de serviço")[1];
  const blackFriday = requiredMatch(source, /Black Friday:\s*\d{2}\/\d{2}\/(\d{4}),\s*com campanha de\s*(\d{2}\/\d{2})(?:\/\d{4})?\s*a\s*(\d{2}\/\d{2})(?:\/\d{4})?/i, "Campanha de Black Friday");
  const christmas = requiredMatch(source, /Natal:\s*campanha de\s*(\d{2}\/\d{2})(?:\/\d{4})?\s*a\s*(\d{2}\/\d{2})(?:\/\d{4})?/i, "Campanha de Natal");
  const campaignYear = blackFriday[1];
  const planStart = date(`${budgetRow[1]}/${budgetRow[2].slice(-4)}`);
  const planEnd = date(budgetRow[2]);
  const budget = Number(budgetRow[3].replaceAll(".", "").replace(",", "."));
  const params: BusinessParameters = {
    referenceDate,
    historyStart,
    planStart,
    planEnd,
    budget,
    serviceLevel: Number(serviceRate.replace(",", ".")),
    annualCapitalCostRate: percent(capitalRate),
    monthlyStorageCostRate: percent(storageRate),
    maxLiquidationDiscount: percent(discountRate),
    blackFridayStart: date(`${blackFriday[2]}/${campaignYear}`),
    blackFridayEnd: date(`${blackFriday[3]}/${campaignYear}`),
    christmasStart: date(`${christmas[1]}/${campaignYear}`),
    christmasEnd: date(`${christmas[2]}/${campaignYear}`),
  };
  if (params.planEnd < params.planStart || params.referenceDate < params.historyStart ||
      params.budget <= 0 || params.serviceLevel <= 50 || params.serviceLevel >= 100) {
    throw new Error("Parâmetros de estoque inconsistentes");
  }
  return params;
}

const dataDirectory = path.resolve(process.env.DATA_DIR || fileURLToPath(new URL("../../data/", import.meta.url)));

export function loadBusinessParameters(): BusinessParameters {
  try {
    return parseBusinessParameters(readFileSync(path.join(dataDirectory, "parametros.md"), "utf8"));
  } catch (error) {
    console.error(`Falha ao carregar parametros.md de ${dataDirectory}:`, error);
    throw new Error("Não foi possível carregar parametros.md. Verifique DATA_DIR e o formato do arquivo.");
  }
}

// Defaults keep small in-memory fixtures usable; production startup always loads parametros.md.
export const defaultBusinessParameters: BusinessParameters = {
  referenceDate: "2026-09-29",
  historyStart: "2025-04-01",
  planStart: "2026-10-01",
  planEnd: "2026-12-29",
  budget: 1_970_000,
  serviceLevel: 98,
  annualCapitalCostRate: 0.18,
  monthlyStorageCostRate: 0.012,
  maxLiquidationDiscount: 0.4,
  blackFridayStart: "2026-11-20",
  blackFridayEnd: "2026-11-30",
  christmasStart: "2026-12-01",
  christmasEnd: "2026-12-22",
};
