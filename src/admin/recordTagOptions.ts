export const recordTags = [
  { value: "new_arrival", label: "New arrival" },
  { value: "recommended", label: "Recommended" },
  { value: "bestseller", label: "Bestseller" },
  { value: "record_of_the_week", label: "Record of the week" },
  { value: "sale", label: "Sale" },
];
export function readRecordTags(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter((tag): tag is string => typeof tag === "string"),
        ),
      ]
    : [];
}
