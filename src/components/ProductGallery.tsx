import { useState } from "react";
import { ChevronLeft, ChevronRight, Disc3 } from "lucide-react";
import type { Product } from "../scripts/product";
import { readRecordTags } from "../admin/recordTagOptions";
const tagLabels: Record<string, string> = {
  local: "Local",
  new_arrival: "New Arrival",
  record_of_the_week: "Record of the Week",
  recommended: "Recommended",
  bestseller: "Best Seller",
  sale: "On Sale",
  preorder: "Preorder",
};
import { galleryImages } from "../products/productImages";
function Photo({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt={alt} onError={() => setFailed(true)} className="block h-full w-full object-contain" /> : <div role="img" aria-label="Photo unavailable" className="grid h-full place-items-center text-[#cbb79c]"><Disc3 size={48} strokeWidth={1} aria-hidden="true" /></div>;
}
export default function ProductGallery({ product }: { product: Product }) {
  const tags = readRecordTags(product.tags);
  const images = galleryImages(product), [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, images.length - 1)), multiple = images.length > 1;
  const move = (direction: number) => setIndex((current + direction + images.length) % images.length);
  const control = "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#15120f]/85 text-[#efe8dc] hover:bg-[#49392b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cbb79c]";
  return <div role="region" aria-label={`${product.title} photos`} aria-roledescription={multiple ? "carousel" : undefined} onKeyDown={event => {
    if (!multiple || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1);
  }}>
    <div className="relative aspect-square overflow-hidden bg-[#28231d]">
      {tags.length > 0 && (
        <ul aria-label="Record tags" className="pointer-events-none absolute inset-x-2 top-2 z-10 m-0 flex list-none flex-wrap items-start gap-1.5 p-0">
          {tags.map(tag => (
            <li key={tag} className="max-w-full rounded-full border border-[#cbb79c]/20 bg-[#211b16]/80 px-2.5 py-1 text-left font-[Arial,sans-serif] text-[10px] leading-5 text-[#efe8dc] sm:text-xs">
              {tagLabels[tag] || tag.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      )}
      <Photo key={images[current] || "missing"} src={images[current]} alt={`${product.artist} — ${product.title}${multiple ? ` — photo ${current + 1} of ${images.length}` : " cover"}`} />
      {multiple && <><button type="button" aria-label="Previous product photo" onClick={() => move(-1)} className={`${control} left-1 sm:left-2`}><ChevronLeft size={20} aria-hidden="true" /></button><button type="button" aria-label="Next product photo" onClick={() => move(1)} className={`${control} right-1 sm:right-2`}><ChevronRight size={20} aria-hidden="true" /></button></>}
    </div>
    {multiple && <>
      <p aria-live="polite" aria-atomic="true" className="my-2 text-center text-xs text-[#c0b4a3]">Photo {current + 1} of {images.length}</p>
      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Choose product photo">
        {images.map((src, i) => <button key={src} type="button" aria-label={`Show product photo ${i + 1}`} aria-pressed={current === i} onClick={() => setIndex(i)} className={`size-11 shrink-0 overflow-hidden rounded border-2 bg-[#28231d] p-0.5 sm:size-14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cbb79c] ${current === i ? "border-[#cbb79c]" : "border-transparent hover:border-white/40"}`}><img src={src} alt="" loading="lazy" className="h-full w-full object-contain" /></button>)}
      </div>
    </>}
  </div>;
}
