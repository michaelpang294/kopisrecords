export type PreorderLine = { productId: number; status: string; expectedArrival: string | null };
export const progressLabels: Record<string, string> = { awaiting_release: "Awaiting release", on_the_way: "On the way to us", ready: "Ready" };
export const mixedOrderNotice = "If your order includes a preorder, we’ll wait until all your records are ready before arranging collection or delivery. This includes any in-stock records purchased in the same order. Arrival dates are estimates.";
export function arrivalDate(value?: string | null) {
  if (!value) return "To be confirmed";
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(+date) ? new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date) : "To be confirmed";
}
export default function PreorderProgress({ preorders = [], items, active = true }: { preorders?: PreorderLine[]; items: { id: number; title: string }[]; active?: boolean }) {
  if (!active || !preorders.length) return null;
  const waiting = preorders.some((item) => item.status !== "ready");
  return (
    <section aria-label="Preorder progress" className="my-5 rounded-lg border border-[#cbb79c]/30 bg-[#cbb79c]/5 p-4">
      <h3 className="mb-3 font-marcellus text-xl">Preorder progress</h3>
      <ul className="space-y-4 text-sm">
        {preorders.map((line) => <li key={line.productId}>
          <p className="font-medium">{items.find((item) => Number(item.id) === line.productId)?.title || `Record #${line.productId}`}</p>
          <p className="mt-1 text-[#cbb79c]">{progressLabels[line.status] || "Awaiting release"}</p>
          <p className="mt-1 text-xs text-[#c0b4a3]">Expected date of arrival: {arrivalDate(line.expectedArrival)}</p>
        </li>)}
      </ul>
      {active && <p className="mt-4 text-xs leading-6 text-[#c0b4a3]">{waiting ? mixedOrderNotice : "All preorder titles are ready. Please wait for your separate collection-ready or dispatch confirmation before making arrangements."}</p>}
    </section>
  );
}
