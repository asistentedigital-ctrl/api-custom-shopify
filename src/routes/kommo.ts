import { Router } from "express";
import { logger } from "../logger";
import { searchProducts } from "../services/shopifyClient";
import { kommoRequestSchema, type KommoResponse } from "../types/kommo";

export const kommoRouter = Router();

/**
 * Punto de entrada único para el Salesbot de Kommo (paso widget_request).
 * El campo `action` decide qué acción de Shopify se ejecuta.
 * Agregar nuevas acciones aquí conforme se construya el API custom de Shopify.
 */
kommoRouter.post("/webhook", async (req, res) => {
  const raw = req.body ?? {};
  logger.info({ body: raw }, "kommo_webhook_body");

  // El widget_request de Kommo puede envolver el payload en un campo "data".
  const unwrapped =
    !raw.action && raw.data && typeof raw.data === "object" ? raw.data : raw;

  const parsed = kommoRequestSchema.safeParse(unwrapped);

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
      const first = products[0];

      // Campos planos + mensaje listo para enviar, porque las variables del
      // Salesbot ({{json.campo}}) no navegan arrays anidados.
      let message: string;
      if (!first) {
        message = `No encontré productos que coincidan con "${query}".`;
      } else if (!first.available) {
        message = `${first.title} — $${first.price}. Agotado por el momento.`;
      } else {
        const parts = [`${first.title} — $${first.price}.`];
        if (first.sizes.length) parts.push(`Tallas disponibles: ${first.sizes.join(", ")}.`);
        if (first.colors.length) parts.push(`Colores: ${first.colors.join(", ")}.`);
        message = parts.join(" ");
      }

      res.status(200).json({
        ok: true,
        found: products.length > 0,
        message,
        product_title: first?.title ?? "",
        product_price: first?.price ?? "",
        product_sizes: first?.sizes.join(", ") ?? "",
        product_colors: first?.colors.join(", ") ?? "",
        data: { products },
      });
      return;
    }

    default: {
      const response: KommoResponse = { ok: false, error: `unknown_action:${action}` };
      res.status(400).json(response);
    }
  }
});
