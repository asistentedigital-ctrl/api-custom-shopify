interface ProductForMessage {
  title: string;
  price: string;
  available: boolean;
  sizes: string[];
  colors: string[];
}

export function buildProductMessage(products: ProductForMessage[], query: string): string {
  const first = products[0];

  if (!first) {
    return `No encontré productos que coincidan con "${query}".`;
  }

  if (!first.available) {
    return `${first.title} — $${first.price}. Agotado por el momento.`;
  }

  const parts = [`${first.title} — $${first.price}.`];
  if (first.sizes.length) parts.push(`Tallas disponibles: ${first.sizes.join(", ")}.`);
  if (first.colors.length) parts.push(`Colores: ${first.colors.join(", ")}.`);
  return parts.join(" ");
}
