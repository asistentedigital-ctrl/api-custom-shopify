import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).send(
    "<h1>kommo-shopify-api</h1><p>API puente entre Kommo y Shopify. " +
      "Endpoints: <code>GET /health</code>, <code>POST /api/kommo/webhook</code> (requiere X-API-KEY).</p>"
  );
});

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
