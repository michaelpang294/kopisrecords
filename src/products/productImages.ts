export function readProductImages(value: unknown): string[] {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? [...new Set(value.filter((url): url is string => typeof url === "string" && Boolean(url.trim())).map(url => url.trim()))] : [];
}
export function galleryImages(product: { cover_image?: string; images?: unknown }): string[] {
  return [...new Set([product.cover_image?.trim(), ...readProductImages(product.images)].filter((url): url is string => Boolean(url)))];
}
