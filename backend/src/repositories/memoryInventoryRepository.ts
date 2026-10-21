import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

export type InventoryRow = Record<string, string>;

export interface InventoryRepository {
  rows(filename: string): Promise<InventoryRow[]>;
}

export class InventoryDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryDataError";
  }
}

const expectedFiles = ["skus.csv", "vendas_diarias.csv", "estoque_diario.csv", "compras.csv", "fornecedores.csv"];
const projectDataDirectory = fileURLToPath(new URL("../../data/", import.meta.url));

function loadSeed(): Map<string, InventoryRow[]> {
  const rowsByFile = new Map<string, InventoryRow[]>();
  const dataDirectory = path.resolve(process.env.DATA_DIR || projectDataDirectory);
  for (const filename of expectedFiles) {
    const filePath = path.join(dataDirectory, filename);
    try {
      const contents = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
      const rows = parse(contents, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      }) as InventoryRow[];
      rowsByFile.set(filename, rows);
    } catch (error) {
      console.error(`Falha ao carregar ${filename} de ${dataDirectory}:`, error);
      throw new InventoryDataError(`Não foi possível carregar ${filename}. Verifique DATA_DIR e o formato do CSV.`);
    }
  }
  return rowsByFile;
}

export class MemoryInventoryRepository implements InventoryRepository {
  private readonly data = loadSeed();

  async rows(filename: string): Promise<InventoryRow[]> {
    const rows = this.data.get(filename);
    if (!rows) throw new InventoryDataError(`Fonte de dados desconhecida: ${filename}`);
    return rows;
  }
}
