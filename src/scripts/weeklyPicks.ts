import type { Product } from "./picksOfTheWeek";

export function weeklyPicks(products: Product[]): Product[] {
  return products.filter((product) => {
    let tags: unknown = product.tags;
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        return false;
      }
    }
    return Array.isArray(tags) && tags.includes("record_of_the_week");
  });
}
