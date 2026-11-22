import { useEffect, useState } from "react";
import type { Product } from "../scripts/product";
import { adminJson } from "./adminApi";
import { adminButton, adminField, adminPanel } from "./productForm";
import { readRecordTags, recordTags } from "./recordTagOptions";
import useUnsavedChanges from "./useUnsavedChanges";

type Change = "keep" | "add" | "remove";
const editableTags = recordTags.filter(tag => tag.value !== "preorder");
export default function TagEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const add = editableTags.filter(tag => changes[tag.value] === "add").map(tag => tag.value);
  const remove = editableTags.filter(tag => changes[tag.value] === "remove").map(tag => tag.value);
  useUnsavedChanges(selected.length > 0 && add.length + remove.length > 0);
  useEffect(() => {
    const controller = new AbortController();
    adminJson<Product[]>("/api/stock?inventory=on-hand", { signal: controller.signal })
      .then(setProducts)
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load records."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [version]);
  const matches = products.filter(product =>
    `${product.title} ${product.artist} ${product.variant} ${product.barcode}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!filter || (filter === "not-preorder" ? !readRecordTags(product.tags).includes("preorder") : readRecordTags(product.tags).includes(filter))),
  );
  const allMatching = matches.length > 0 && matches.every(product => selected.includes(product.id));
  function reload() {
    setLoading(true); setError(""); setMessage(""); setSelected([]); setChanges({}); setVersion(value => value + 1);
  }
  async function save() {
    if (busy || !selected.length || !add.length && !remove.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await adminJson<{ records: { id: number; tags: string[] }[] }>("/api/admin/tags", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: products.filter(product => selected.includes(product.id)).map(product => ({ id: product.id, expectedTags: readRecordTags(product.tags) })), add, remove }),
      });
      const saved = new Map(result.records.map(record => [record.id, record.tags]));
      setProducts(current => current.map(product => saved.has(product.id) ? { ...product, tags: saved.get(product.id)! } : product));
      setMessage(`Tags saved for ${result.records.length} records.`); setSelected([]); setChanges({});
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save tags."); }
    finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="tag-editor-title">
      <h2 id="tag-editor-title" className="mb-2 font-marcellus text-2xl sm:text-3xl">Tag Editor</h2>
      <p className="mb-5 text-sm text-[#c0b4a3]">Select records, choose tags to add or remove, then save once. All other tags stay unchanged.</p>
      <fieldset disabled={busy || loading} className="min-w-0 space-y-4">
        <div className={adminPanel}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Search records<input className={adminField} value={query} onChange={event => setQuery(event.target.value)} placeholder="Album, artist, variant or barcode" /></label>
            <label className="text-sm">Filter records<select className={adminField} value={filter} onChange={event => setFilter(event.target.value)}><option value="">All records</option><option value="not-preorder">Exclude preorders</option>{recordTags.map(tag => <option key={tag.value} value={tag.value}>{tag.label}</option>)}</select></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className={adminButton} disabled={!matches.length} onClick={() => setSelected(current => allMatching ? current.filter(id => !matches.some(product => product.id === id)) : [...new Set([...current, ...matches.map(product => product.id)])])}>{allMatching ? "Deselect matching" : `Select all matching (${matches.length})`}</button>
            <button type="button" className={adminButton} onClick={() => setSelected([])} disabled={!selected.length}>Clear selection</button>
            <span>{selected.length} selected · {selected.filter(id => !matches.some(product => product.id === id)).length} hidden by filters</span>
          </div>
        </div>
        <div className={`${adminPanel} max-h-[440px] overflow-y-auto`} aria-label="Records to tag">
          {matches.map(product => <label key={product.id} className="flex cursor-pointer items-start gap-3 border-b border-white/10 py-3 last:border-0">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#cbb79c]" checked={selected.includes(product.id)} onChange={event => setSelected(current => event.target.checked ? [...current, product.id] : current.filter(id => id !== product.id))} />
            <span className="min-w-0 text-sm"><strong>{product.artist} — {product.title}</strong><span className="block text-xs text-[#c0b4a3]">#{product.id} · {[product.medium, product.variant].filter(Boolean).join(" · ")}</span><span className="mt-1 block text-xs text-[#cbb79c]">{readRecordTags(product.tags).map(tag => recordTags.find(option => option.value === tag)?.label || tag).join(" · ") || "No tags"}</span></span>
          </label>)}
          {!loading && !matches.length && <p className="text-sm text-[#c0b4a3]">No matching records.</p>}
        </div>
        <div className={adminPanel}>
          <h3 className="mb-3 font-marcellus text-xl">Changes for selected records</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{editableTags.map(tag => <label key={tag.value} className="text-sm">{tag.label}<select className={adminField} value={changes[tag.value] || "keep"} onChange={event => setChanges(current => ({ ...current, [tag.value]: event.target.value as Change }))}><option value="keep">Keep unchanged</option><option value="add">Add tag</option><option value="remove">Remove tag</option></select></label>)}</div>
          <p className="mt-3 text-xs text-[#c0b4a3]">To retire older arrivals: filter New arrival → select records → New arrival: Remove tag. Preorder status is managed in Edit records; exclude preorders before adding New arrival.</p>
        </div>
      </fieldset>
      {loading && <p role="status" className="my-4 text-sm">Loading records…</p>}
      {error && <p role="alert" className="my-4 text-sm text-[#f0b8a8]">{error}</p>}
      {message && <p role="status" className="my-4 text-sm text-[#cbb79c]">{message}</p>}
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-white/15 bg-[#15120f]/95 p-4">
        <button type="button" disabled={busy || loading || !selected.length || !add.length && !remove.length} onClick={() => void save()} className={`${adminButton} bg-[#cbb79c] text-[#15120f] disabled:opacity-40`}>{busy ? "Saving…" : `Save tags for ${selected.length} records`}</button>
        <button type="button" disabled={busy || loading} className={adminButton} onClick={() => { if (!selected.length || window.confirm("Reload records and discard the current selection and tag changes?")) reload(); }}>Reload records</button>
        <span className="text-xs text-[#c0b4a3]">{add.length ? `Add: ${add.map(tag => recordTags.find(option => option.value === tag)?.label).join(", ")}. ` : ""}{remove.length ? `Remove: ${remove.map(tag => recordTags.find(option => option.value === tag)?.label).join(", ")}.` : ""}</span>
      </div>
    </section>
  );
}
