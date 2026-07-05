import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  KOMMO_API_KEY: z.string().min(1, "KOMMO_API_KEY es obligatorio"),
  // Para escribir la respuesta de Shopify en un campo del lead (flujo
  // "Enviar webhook" del Salesbot, que no puede leer respuestas HTTP).
  KOMMO_SUBDOMAIN: z.string().optional(),
  KOMMO_ACCESS_TOKEN: z.string().optional(),
  KOMMO_QUERY_FIELD_ID: z.coerce.number().optional(),
  KOMMO_RESPONSE_FIELD_ID: z.coerce.number().optional(),
  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  // Solo para apps personalizadas heredadas (token estático shpat_).
  // Las apps nuevas del Dev Dashboard usan CLIENT_ID/CLIENT_SECRET.
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default("2026-07"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
