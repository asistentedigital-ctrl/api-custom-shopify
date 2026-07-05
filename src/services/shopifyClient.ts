import { config } from "../config";
import { logger } from "../logger";
import { getAccessToken, isShopifyConfigured } from "./shopifyAuth";

/**
 * Cliente de la Admin API de Shopify. La autenticación (client credentials
 * grant o token estático heredado) vive en shopifyAuth.ts.
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

interface ShopifyVariant {
  price: string;
  inventory_quantity: number | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
}

async function adminApiFetch(path: string): Promise<Response> {
  const token = await getAccessToken();
  const url = `https://${config.SHOPIFY_STORE_DOMAIN}/admin/api/${config.SHOPIFY_API_VERSION}${path}`;
  return fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult[]> {
  if (!isShopifyConfigured()) {
    logger.warn({ params }, "shopify_not_configured");
    return [];
  }

  const res = await adminApiFetch(
    `/products.json?title=${encodeURIComponent(params.query)}&limit=10`
  );

  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text() }, "shopify_product_search_failed");
    return [];
  }

  const body = (await res.json()) as { products: ShopifyProduct[] };

  return body.products.map((product) => ({
    id: String(product.id),
    title: product.title,
    price: product.variants[0]?.price ?? "0.00",
    available: product.variants.some((variant) => (variant.inventory_quantity ?? 0) > 0),
  }));
}
