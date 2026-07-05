import { z } from "zod";

/**
 * Contrato genérico para el paso "Webhook" del Salesbot de Kommo.
 * `action` decide qué operación de Shopify se ejecuta; `payload` son los
 * campos libres que el bot completa con variables del lead/contacto.
 */
export const kommoRequestSchema = z.object({
  action: z.string().min(1),
  lead_id: z.union([z.string(), z.number()]).optional(),
  contact_id: z.union([z.string(), z.number()]).optional(),
  payload: z.record(z.unknown()).default({}),
});

export type KommoRequest = z.infer<typeof kommoRequestSchema>;

export interface KommoResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
