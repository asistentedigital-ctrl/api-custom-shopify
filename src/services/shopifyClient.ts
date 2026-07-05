import { config } from "../config";
import { logger } from "../logger";

/**
 * Cliente de Shopify — placeholder.
 * Reemplazar cada método por llamadas reales a la Admin API de Shopify
 * (REST o GraphQL) cuando se construya la integración custom.
 */

interface ProductSearchParams {
  query: string;
}

interface ProductSearchResult {
  id: string;
  title: string;
  price: string;
  available: boolean;
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult[]> {
  if (!config.SHOPIFY_STORE_DOMAIN || !config.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    logger.warn({ params }, "shopify_not_configured");
    return [];
  }

  // TODO: reemplazar por el fetch real a
  // https://{SHOPIFY_STORE_DOMAIN}/admin/api/{SHOPIFY_API_VERSION}/products.json?title=...
  return [];
}
