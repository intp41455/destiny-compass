import Fastify from "fastify";
import cors from "@fastify/cors";
import { vedicRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3013);

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(vedicRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`MCP-Vedic service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
