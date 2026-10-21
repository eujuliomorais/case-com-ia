import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(here, ".."), "");
  const backendHost = env.HOST || "127.0.0.1";
  const backendPort = env.PORT || "8000";
  return {
    plugins: [react()],
    server: { proxy: { "/api": `http://${backendHost}:${backendPort}` } },
  };
});
