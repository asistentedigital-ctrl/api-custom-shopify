import { config } from "../config";
import { logger } from "../logger";

/**
 * Obtiene y cachea el Admin API access token.
 *
 * Apps del Dev Dashboard (post-2026): client credentials grant —
 * se intercambian CLIENT_ID/CLIENT_SECRET por un token que dura 24h
 * y se renueva automáticamente antes de expirar.
 *
 * Apps heredadas: si SHOPIFY_ADMIN_ACCESS_TOKEN está definido, se usa tal cual.
 */

interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in: number;
}

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

export function isShopifyConfigured(): boolean {
  if (!config.SHOPIFY_STORE_DOMAIN) return false;
  return Boolean(
    config.SHOPIFY_ADMIN_ACCESS_TOKEN || (config.SHOPIFY_CLIENT_ID && config.SHOPIFY_CLIENT_SECRET)
  );
}

export async function getAccessToken(): Promise<string> {
  if (config.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return config.SHOPIFY_ADMIN_ACCESS_TOKEN;
  }

  // Renovar 5 minutos antes de que expire.
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const url = `https://${config.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.SHOPIFY_CLIENT_ID as string,
      client_secret: config.SHOPIFY_CLIENT_SECRET as string,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, "shopify_token_exchange_failed");
    throw new Error(`shopify_token_exchange_failed: ${res.status}`);
  }

  const data = (await res.json()) as TokenResponse;
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + data.expires_in * 1000;
  logger.info({ scope: data.scope, expires_in: data.expires_in }, "shopify_token_refreshed");

  return cachedToken;
}
