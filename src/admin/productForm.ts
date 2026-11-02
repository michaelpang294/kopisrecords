import type { Product } from "../scripts/picksOfTheWeek";
import { readRecordTags } from "./recordTagOptions";
export type ProductForm = {
  title: string;
  artist: string;
  price: string;
  genre: string;
  cover_image: string;
  description: string;
  medium: string;
  variant: string;
  released: string;
  barcode: string;
  stock: string;
  tags: string[];
};
export function emptyProduct(): ProductForm {
  return {
    title: "",
    artist: "",
    price: "",
    genre: "",
    cover_image: "",
    description: "",
    medium: "Vinyl",
    variant: "",
    released: "",
    barcode: "",
    stock: "1",
    tags: ["new_arrival"],
  };
}
export function productForm(product: Product): ProductForm {
  return {
    title: product.title,
    artist: product.artist,
    price: String(product.price),
    genre: product.genre || "",
    cover_image: product.cover_image || "",
    description: product.description || "",
    medium: product.medium,
    variant: product.variant || "",
    released: product.released || "",
    barcode: product.barcode || "",
    stock: String(product.stock),
    tags: readRecordTags(product.tags),
  };
}
export function productPayload(form: ProductForm) {
  if (!form.title.trim() || !form.artist.trim())
    throw Error("Enter a record title and artist.");
  if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim()))
    throw Error("Enter a price with up to two decimal places.");
  if (!/^\d+$/.test(form.stock) || Number(form.stock) > 4294967295)
    throw Error("Stock must be a whole number of zero or more.");
  return {
    ...form,
    title: form.title.trim(),
    artist: form.artist.trim(),
    price: Number(form.price),
    stock: Number(form.stock),
  };
}
export const adminField =
  "mt-2 block min-h-12 w-full min-w-0 rounded-lg border border-white/15 bg-[#15120f] px-3 py-3 text-base text-[#efe8dc] outline-none placeholder:text-[#c0b4a3]/45 focus:border-[#cbb79c] disabled:opacity-60";
export const adminButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cbb79c] disabled:opacity-50";
export const adminPanel =
  "rounded-xl border border-white/10 bg-[#211b16]/95 p-4 sm:p-6";
