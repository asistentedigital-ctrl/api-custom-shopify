import { config } from "../config";
import { logger } from "../logger";
import { getAccessToken, isShopifyConfigured } from "./shopifyAuth";

/**
 * Cliente de la Admin API de Shopify (GraphQL). La autenticación (client
 * credentials grant o token estático heredado) vive en shopifyAuth.ts.
 */

interface ProductSearchParams {
  query: string;
}

interface ProductVariantResult {
  size: string;
  price: string;
  available: boolean;
  stock: number;
}

interface ProductSearchResult {
  id: string;
  title: string;
  price: string;
  available: boolean;
  sizes: string[];
  variants: ProductVariantResult[];
}

interface ProductsGraphqlResponse {
  data?: {
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          totalInventory: number | null;
          variants: {
            edges: Array<{
              node: {
                title: string;
                price: string;
                inventoryQuantity: number | null;
                selectedOptions: Array<{ name: string; value: string }>;
              };
            }>;
          };
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

async function adminGraphql(query: string, variables: Record<string, unknown>): Promise<Response> {
  const token = await getAccessToken();
  const url = `https://${config.SHOPIFY_STORE_DOMAIN}/admin/api/${config.SHOPIFY_API_VERSION}/graphql.json`;
  return fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
}

// La opción del producto que representa la talla (Talla, Size, etc.);
// si no existe, se usa el título de la variante.
function variantSize(variant: { title: string; selectedOptions: Array<{ name: string; value: string }> }): string {
  const sizeOption = variant.selectedOptions.find((opt) => /talla|size/i.test(opt.name));
  return sizeOption?.value ?? variant.title;
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResult[]> {
  if (!isShopifyConfigured()) {
    logger.warn({ params }, "shopify_not_configured");
    return [];
  }

  // Búsqueda parcial por título; sin query devuelve los primeros productos.
  const sanitized = params.query.replace(/["\\]/g, "").trim();
  const searchQuery = sanitized ? `title:*${sanitized}*` : "";

  const gql = `
    query ProductSearch($query: String!) {
      products(first: 10, query: $query) {
        edges {
          node {
            id
            title
            totalInventory
            variants(first: 50) {
              edges {
                node {
                  title
                  price
                  inventoryQuantity
                  selectedOptions { name value }
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await adminGraphql(gql, { query: searchQuery });

  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text() }, "shopify_product_search_failed");
    return [];
  }

  const body = (await res.json()) as ProductsGraphqlResponse;

  if (body.errors?.length || !body.data) {
    logger.error({ errors: body.errors }, "shopify_product_search_graphql_errors");
    return [];
  }

  return body.data.products.edges.map(({ node }) => {
    const variants = node.variants.edges.map(({ node: variant }) => ({
      size: variantSize(variant),
      price: variant.price,
      available: (variant.inventoryQuantity ?? 0) > 0,
      stock: variant.inventoryQuantity ?? 0,
    }));

    return {
      id: node.id,
      title: node.title,
      price: variants[0]?.price ?? "0.00",
      available: (node.totalInventory ?? 0) > 0,
      sizes: variants.filter((v) => v.available).map((v) => v.size),
      variants,
    };
  });
}
