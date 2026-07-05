import { Router } from "express";
import { logger } from "../logger";
import { searchProducts } from "../services/shopifyClient";
import { kommoRequestSchema, type KommoResponse } from "../types/kommo";

export const kommoRouter = Router();

/**
 * Punto de entrada único para el paso "Webhook" del Salesbot.
 * El campo `action` decide qué acción de Shopify se ejecuta.
 * Agregar nuevas acciones aquí conforme se construya el API custom de Shopify.
 */
kommoRouter.post("/webhook", async (req, res) => {
  const parsed = kommoRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    const response: KommoResponse = { ok: false, error: "invalid_request" };
    res.status(400).json(response);
    return;
  }

  const { action, payload, lead_id } = parsed.data;
  logger.info({ action, lead_id }, "kommo_webhook_received");

  switch (action) {
    case "product_search": {
      const query = String(payload.query ?? "");
      const products = await searchProducts({ query });
      const response: KommoResponse = { ok: true, data: { products } };
      res.status(200).json(response);
      return;
    }

    default: {
      const response: KommoResponse = { ok: false, error: `unknown_action:${action}` };
      res.status(400).json(response);
    }
  }
});
