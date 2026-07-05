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

interface ProductSearchResult {
  id: string;
  title: string;
  price: string;
  available: boolean;
}

interface ProductsGraphqlResponse {
  data?: {
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          totalInventory: number | null;
          variants: { edges: Array<{ node: { price: string } }> };
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
            variants(first: 1) {
              edges { node { price } }
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

  return body.data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    price: node.variants.edges[0]?.node.price ?? "0.00",
    available: (node.totalInventory ?? 0) > 0,
  }));
}
