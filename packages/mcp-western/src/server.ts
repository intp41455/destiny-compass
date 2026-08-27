import Fastify from "fastify";
import cors from "@fastify/cors";
import { westernRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3014);

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(westernRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`MCP-Western service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
