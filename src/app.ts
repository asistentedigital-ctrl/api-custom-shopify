import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { apiKeyAuth } from "./middleware/apiKeyAuth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./logger";
import { healthRouter } from "./routes/health";
import { kommoRouter } from "./routes/kommo";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  // Los webhooks de Kommo pueden llegar como formulario en vez de JSON.
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));

  app.use(healthRouter);
  app.use("/api/kommo", apiKeyAuth, kommoRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
