import express, { type ErrorRequestHandler } from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InventoryController } from "./controllers/inventoryController.js";
import { InventoryDataError, MemoryInventoryRepository } from "./repositories/memoryInventoryRepository.js";
import { AgentService } from "./services/agentService.js";
import { InventoryService } from "./services/inventoryService.js";
import { loadBusinessParameters } from "./config/businessParameters.js";
import { inventoryRoutes } from "./routes/inventoryRoutes.js";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openApi.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env") });

const repository = new MemoryInventoryRepository();
const controller = new InventoryController(new InventoryService(repository, loadBusinessParameters()), new AgentService());
const app = express();
app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (_request.path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
const agentWindowMs = 60_000;
const configuredAgentLimit = Number(process.env.AGENT_REQUESTS_PER_MINUTE);
const agentRequestLimit = Number.isFinite(configuredAgentLimit) && configuredAgentLimit > 0
  ? Math.floor(configuredAgentLimit)
  : 20;
let agentWindow = { startedAt: Date.now(), count: 0 };
app.post("/api/agent/plan", (_request, response, next) => {
  if (!process.env.GROQ_API_KEY?.trim()) return next();
  const now = Date.now();
  if (now - agentWindow.startedAt >= agentWindowMs) agentWindow = { startedAt: now, count: 0 };
  if (agentWindow.count >= agentRequestLimit) {
    response.setHeader("Retry-After", Math.ceil((agentWindow.startedAt + agentWindowMs - now) / 1000));
    response.status(429).json({ error: "Limite temporário de geração do plano atingido. Tente novamente em instantes." });
    return;
  }
  agentWindow.count += 1;
  next();
});
app.use("/api", inventoryRoutes(controller));
app.use("/api", (_request, response) => response.status(404).json({ error: "Rota não encontrada" }));

const frontendBuild = path.resolve(here, "../../frontend/dist");
app.use(express.static(frontendBuild, { index: false, etag: true }));
app.get("*", (_request, response, next) => {
  response.sendFile(path.join(frontendBuild, "index.html"), (error) => error && next(error));
});

const errors: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Erro ao processar requisição:", error);
  const message = error instanceof InventoryDataError ? error.message : "Erro interno do servidor";
  response.status(500).json({ error: message });
};
app.use(errors);

export default app;
