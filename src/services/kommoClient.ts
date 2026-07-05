import { config } from "../config";
import { logger } from "../logger";

/**
 * Cliente mínimo de la API v4 de Kommo, autenticado con un token de larga
 * duración (integración privada). Se usa para leer/escribir campos
 * personalizados del lead.
 */

interface LeadResponse {
  custom_fields_values?: Array<{
    field_id: number;
    values: Array<{ value: unknown }>;
  }> | null;
}

export function isKommoConfigured(): boolean {
  return Boolean(config.KOMMO_SUBDOMAIN && config.KOMMO_ACCESS_TOKEN);
}

async function kommoFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `https://${config.KOMMO_SUBDOMAIN}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.KOMMO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export async function getLeadCustomField(leadId: number, fieldId: number): Promise<string | null> {
  const res = await kommoFetch(`/api/v4/leads/${leadId}`);

  if (!res.ok) {
    logger.error({ leadId, status: res.status, body: await res.text() }, "kommo_get_lead_failed");
    return null;
  }

  const lead = (await res.json()) as LeadResponse;
  const field = lead.custom_fields_values?.find((f) => f.field_id === fieldId);
  const value = field?.values[0]?.value;
  return value == null ? null : String(value);
}

export async function setLeadCustomField(
  leadId: number,
  fieldId: number,
  value: string
): Promise<boolean> {
  const res = await kommoFetch(`/api/v4/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({
      custom_fields_values: [{ field_id: fieldId, values: [{ value }] }],
    }),
  });

  if (!res.ok) {
    logger.error({ leadId, fieldId, status: res.status, body: await res.text() }, "kommo_set_field_failed");
    return false;
  }

  return true;
}
