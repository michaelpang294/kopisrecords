import type { Product } from "../scripts/product";
export const ZINE_BARCODE = "KOPIS-ZINE-TOP100";
export const isZine = (product: Product) => product.barcode === ZINE_BARCODE || (product.medium === "Zine" && product.title.toLowerCase().includes("top 100"));
