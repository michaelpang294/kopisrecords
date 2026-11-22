import { useId, useState } from "react";
import type { ProductForm } from "./productForm";
import { adminField, adminPanel } from "./productForm";
import { isPreorder } from "../scripts/preorder";
import RecordTags from "./RecordTags";

function CoverPreview({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  if (!src) return null;
  if (!/^https?:\/\//i.test(src) && !/^\/(?!\/)/.test(src)) {
    return <p className="mt-2 text-xs text-[#f0b8a8]">Use a public http/https image URL or a path starting with /.</p>;
  }
  return (
    <div className="mt-3" aria-live="polite">
      {status !== "failed" && (
        <img src={src} alt="Cover image preview" referrerPolicy="no-referrer" onLoad={() => setStatus("ready")} onError={() => setStatus("failed")} className="block h-36 w-36 rounded-md border border-white/15 bg-[#15120f] object-contain" />
      )}
      <p className={`mt-2 text-xs ${status === "failed" ? "text-[#f0b8a8]" : "text-[#c0b4a3]"}`}>
        {status === "failed" ? "Couldn’t load this image. Check that the link opens an image directly and is publicly accessible." : status === "ready" ? "Image loaded successfully." : "Loading image preview…"}
      </p>
    </div>
  );
}
export default function ProductFields({
  value,
  onChange,
  newListing = false,
}: {
  value: ProductForm;
  onChange: (value: ProductForm) => void;
  newListing?: boolean;
}) {
  const prefix = useId();
  function field(
    key: Exclude<keyof ProductForm, "tags">,
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) {
    return (
      <label
        className="block min-w-0 text-sm text-[#c0b4a3]"
        htmlFor={`${prefix}-${key}`}
      >
        {label}
        <input
          id={`${prefix}-${key}`}
          name={key}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          className={adminField}
          {...extra}
        />
      </label>
    );
  }
  return (
    <div className="space-y-4">
      <section className={adminPanel} aria-labelledby={`${prefix}-basic`}>
        <h3 id={`${prefix}-basic`} className="mb-5 font-marcellus text-xl">
          The record
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("title", "Album title", {
            required: true,
            maxLength: 255,
            placeholder: "Album name",
          })}
          {field("artist", "Artist", {
            required: true,
            maxLength: 255,
            placeholder: "Artist or band",
          })}
          <label className="block text-sm text-[#c0b4a3]">
            Format
            <select
              name="medium"
              value={value.medium}
              onChange={(e) => onChange({ ...value, medium: e.target.value })}
              className={adminField}
            >
              <option value="Vinyl">Vinyl</option>
              <option value="CD">CD</option>
              <option value="Zine">Zine</option>
            </select>
          </label>
          {field("variant", "Pressing / variant", {
            maxLength: 255,
            placeholder: "Black vinyl, limited edition…",
          })}
        </div>
      </section>
      <section className={adminPanel} aria-labelledby={`${prefix}-pricing`}>
        <h3 id={`${prefix}-pricing`} className="mb-5 font-marcellus text-xl">
          Price & stock
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {field("price", "Price ($)", {
            required: true,
            inputMode: "decimal",
            placeholder: "40.00",
          })}
          {field("stock", isPreorder(value) ? "Preorder copies available" : "Copies on hand", {
            required: true,
            inputMode: "numeric",
            pattern: "[0-9]+",
            placeholder: "1",
          })}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#c0b4a3]">
          Physical copies you have, including any held for open orders.
        </p>
      </section>
      <RecordTags
        value={value.tags}
        newListing={newListing}
        onChange={(tags) => onChange({ ...value, tags })}
      />
      <details className={adminPanel}>
        <summary className="min-h-11 cursor-pointer font-marcellus text-xl">
          More details{" "}
          <span className="ml-2 font-[Arial,sans-serif] text-xs text-[#c0b4a3]">
            Optional
          </span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {field("genre", "Genres", {
            maxLength: 255,
            placeholder: "Shoegaze, Alternative rock",
          })}
          {field("released", isPreorder(value) ? "Preorder release date (YYYY-MM-DD)" : "Release year / date", {
            maxLength: 30,
            placeholder: isPreorder(value) ? "2027-03-26" : "1993",
          })}
          {field("barcode", "Barcode", {
            inputMode: "numeric",
            maxLength: 100,
            placeholder: "Scan or enter barcode",
          })}
          <div className="min-w-0">
          {field("cover_image", "Cover image URL", {
            maxLength: 2048,
            inputMode: "url",
            placeholder: "https://…",
          })}
          <CoverPreview key={value.cover_image.trim()} src={value.cover_image.trim()} />
          </div>
          <label className="block text-sm text-[#c0b4a3] sm:col-span-2">
            Additional product photos (one URL per line)
            <textarea name="images" rows={4} value={value.images} onChange={e => onChange({ ...value, images: e.target.value })} className={adminField} placeholder={"https://…/back-cover.jpg\nhttps://…/vinyl.jpg"} />
            <span className="mt-2 block text-xs">Optional, up to 20 extra photos. The cover image appears first. Use public image URLs.</span>
          </label>
          <label className="block text-sm text-[#c0b4a3] sm:col-span-2">
            Description
            <textarea
              name="description"
              rows={4}
              maxLength={10000}
              value={value.description}
              onChange={(e) =>
                onChange({ ...value, description: e.target.value })
              }
              className={adminField}
              placeholder="Notes about this pressing…"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
