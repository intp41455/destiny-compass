import Fastify from "fastify";
import cors from "@fastify/cors";
import { llmRoutes } from "./routes.js";
import { getProviderConfig } from "./llm-adapter.js";

const PORT = Number(process.env.PORT ?? 3018);

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(llmRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    const cfg = getProviderConfig();
    app.log.info(
      `MCP-LLM service listening on port ${PORT} (baseUrl=${cfg.baseUrl}, configured=${cfg.apiKey !== null})`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
