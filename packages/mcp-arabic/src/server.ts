import Fastify from "fastify";
import cors from "@fastify/cors";
import { arabicRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 3015);

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(arabicRoutes);

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`MCP-Arabic service listening on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
