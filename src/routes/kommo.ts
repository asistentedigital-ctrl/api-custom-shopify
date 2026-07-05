import { Router } from "express";
import { config } from "../config";
import { logger } from "../logger";
import { buildProductMessage } from "../services/botMessages";
import { getLeadCustomField, isKommoConfigured, setLeadCustomField } from "../services/kommoClient";
import { searchProducts } from "../services/shopifyClient";
import { kommoRequestSchema, type KommoResponse } from "../types/kommo";

export const kommoRouter = Router();

/**
 * Endpoint síncrono genérico (curl, integraciones que sí leen la respuesta).
 * El campo `action` decide qué acción de Shopify se ejecuta.
 */
kommoRouter.post("/webhook", async (req, res) => {
  const raw = req.body ?? {};
  logger.info({ body: raw }, "kommo_webhook_body");

  const unwrapped = !raw.action && raw.data && typeof raw.data === "object" ? raw.data : raw;

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

      res.status(200).json({
        ok: true,
        found: products.length > 0,
        message: buildProductMessage(products, query),
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

/**
 * Endpoint para la acción "Enviar webhook" del Salesbot. Esa acción no lee la
 * respuesta HTTP, así que el flujo es asíncrono:
 *   1. Se responde 200 de inmediato (Kommo exige <2s).
 *   2. Se lee la consulta del cliente desde el campo KOMMO_QUERY_FIELD_ID del lead.
 *   3. Se busca en Shopify y se escribe el mensaje en KOMMO_RESPONSE_FIELD_ID.
 *   4. El bot, tras una pausa, envía el contenido de ese campo al cliente.
 */
kommoRouter.post("/salesbot-hook", (req, res) => {
  logger.info({ body: req.body }, "salesbot_hook_body");
  res.status(200).json({ ok: true });

  void processSalesbotHook(req.body).catch((err) => {
    logger.error({ err }, "salesbot_hook_processing_failed");
  });
});

// La acción "Enviar webhook" varía el formato según el disparador; se intenta
// extraer el id del lead de las formas conocidas.
function extractLeadId(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;

  if (b.lead_id) return Number(b.lead_id);
  if (b.entity_id) return Number(b.entity_id);

  if (b.leads && typeof b.leads === "object") {
    for (const group of Object.values(b.leads as Record<string, unknown>)) {
      if (Array.isArray(group) && group[0]?.id) return Number(group[0].id);
    }
  }

  return null;
}

async function processSalesbotHook(body: unknown): Promise<void> {
  const leadId = extractLeadId(body);

  if (!leadId) {
    logger.warn({ body }, "salesbot_hook_no_lead_id");
    return;
  }

  if (!isKommoConfigured() || !config.KOMMO_QUERY_FIELD_ID || !config.KOMMO_RESPONSE_FIELD_ID) {
    logger.warn("kommo_api_not_configured");
    return;
  }

  const query = await getLeadCustomField(leadId, config.KOMMO_QUERY_FIELD_ID);

  if (!query) {
    logger.warn({ leadId }, "salesbot_hook_empty_query");
    await setLeadCustomField(
      leadId,
      config.KOMMO_RESPONSE_FIELD_ID,
      "No recibí el nombre del producto. ¿Me lo repites?"
    );
    return;
  }

  const products = await searchProducts({ query });
  const message = buildProductMessage(products, query);

  const ok = await setLeadCustomField(leadId, config.KOMMO_RESPONSE_FIELD_ID, message);
  logger.info({ leadId, query, found: products.length, ok }, "salesbot_hook_processed");
}
