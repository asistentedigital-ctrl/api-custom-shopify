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
  name: string;
  size: string;
  color: string | null;
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
  colors: string[];
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

// Localiza una opción del producto por nombre (Talla/Size, Color, etc.).
function findOption(
  variant: { selectedOptions: Array<{ name: string; value: string }> },
  pattern: RegExp
): string | null {
  return variant.selectedOptions.find((opt) => pattern.test(opt.name))?.value ?? null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
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
      name: variant.title,
      size: findOption(variant, /talla|size/i) ?? variant.title,
      color: findOption(variant, /color/i),
      price: variant.price,
      available: (variant.inventoryQuantity ?? 0) > 0,
      stock: variant.inventoryQuantity ?? 0,
    }));

    const availableVariants = variants.filter((v) => v.available);

    return {
      id: node.id,
      title: node.title,
      price: variants[0]?.price ?? "0.00",
      available: (node.totalInventory ?? 0) > 0,
      sizes: unique(availableVariants.map((v) => v.size)),
      colors: unique(availableVariants.map((v) => v.color).filter((c): c is string => c !== null)),
      variants,
    };
  });
}
