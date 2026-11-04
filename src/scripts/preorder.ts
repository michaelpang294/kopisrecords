import { readRecordTags } from "../admin/recordTagOptions";

export function isPreorder(product?: { tags?: unknown }): boolean {
  return readRecordTags(product?.tags).some((tag) => tag.trim().toLowerCase() === "preorder");
}

export function preorderRelease(released?: string): string {
  const value = (released || "").trim();
  if (!value) return "Preorder item · Release date to be announced";
  let display = value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + "T00:00:00Z");
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) {
      display = new Intl.DateTimeFormat("en-SG", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      }).format(date);
    }
  }
  return `Preorder item · Releases ${display}`;
}
