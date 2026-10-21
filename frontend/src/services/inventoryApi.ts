import { requestJson } from "../lib/apiClient";
import type { AgentResponse, DashboardData } from "../types";

const API_BASE_PATH = "/api";

export function getDashboard(): Promise<DashboardData> {
  return requestJson<DashboardData>(`${API_BASE_PATH}/dashboard`);
}

export function generatePlan(): Promise<AgentResponse> {
  return requestJson<AgentResponse>(`${API_BASE_PATH}/agent/plan`, { method: "POST" });
}