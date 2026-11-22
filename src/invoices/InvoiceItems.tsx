import { formatPrice } from "../cart/cartStorage";
type Item = { id?: number; title: string; artist?: string; medium?: string; variant?: string; cover_image?: string; quantity: number; price: number };
export default function InvoiceItems({ items }: { items: Item[] }) {
  return <ul className="divide-y divide-white/10" aria-label="Invoice records">
    {items.map((item, index) => <li key={item.id ?? index} className="flex gap-3 py-4 sm:gap-4">
      {item.cover_image && <img src={item.cover_image} alt={`${item.title} cover`} referrerPolicy="no-referrer" className="size-16 shrink-0 rounded object-contain sm:size-20" />}
      <div className="min-w-0 flex-1 text-sm">
        <p className="break-words font-semibold">{item.quantity} × {item.title}</p>
        <p className="mt-1 break-words text-[#c0b4a3]">{item.artist}</p>
        <p className="mt-1 break-words text-xs text-[#c0b4a3]">Format: {item.medium || "Not specified"}</p>
        <p className="mt-1 break-words text-xs text-[#c0b4a3]">Variant / pressing: {item.variant || "Not specified"}</p>
        <p className="mt-2 text-xs text-[#c0b4a3]">{formatPrice(item.price)} each</p>
      </div>
      <p className="shrink-0 text-sm">{formatPrice(item.price * item.quantity)}</p>
    </li>)}
  </ul>;
}
