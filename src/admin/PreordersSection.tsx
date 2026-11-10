import { useEffect, useState, type FormEvent } from "react";
import { adminJson } from "./adminApi";
import { progressLabels } from "../preorders/PreorderProgress";

type Preorder = { id: number; title: string; artist: string; medium: string; variant: string; released: string; preorderStatus: string; expectedArrival: string | null; preorderVersion: number };
type Result = { products: Preorder[]; failedEmails: number };
const field = "mt-2 block min-h-12 w-full rounded-lg border border-white/15 bg-[#15120f] px-3 py-2 text-base text-[#efe8dc] focus:outline focus:outline-2 focus:outline-[#cbb79c]";
function Editor({ product, saved }: { product: Preorder; saved: (message: string) => void }) {
  const [status, setStatus] = useState(product.preorderStatus);
  const [arrival, setArrival] = useState(product.expectedArrival || "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const changed = status !== product.preorderStatus || arrival !== (product.expectedArrival || "");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !changed) return;
    setBusy(true); setError("");
    try {
      const result = await adminJson<{ message: string }>(`/api/admin/preorders/${product.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, expectedArrival: arrival, version: product.preorderVersion }) });
      saved(result.message);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save preorder."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#211b16]/95 p-5">
      <h3 className="font-marcellus text-xl">{product.title}</h3>
      <p className="mt-1 text-sm text-[#c0b4a3]">{[product.artist, product.medium, product.variant].filter(Boolean).join(" · ")}</p>
      <p className="mt-2 text-xs text-[#c0b4a3]">Product #{product.id} · Release: {product.released || "Not specified"}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Progress<select className={field} value={status} disabled={busy} onChange={(e) => setStatus(e.target.value)}>{Object.entries(progressLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="text-sm">Expected arrival at the shop<input type="date" className={field} value={arrival} disabled={busy} onChange={(e) => setArrival(e.target.value)} /></label>
      </div>
      <p className="mt-3 text-xs leading-6 text-[#c0b4a3]">Save changes to email customers with open paid or payment-reported orders for this title. Blank date means “To be confirmed”. Ready means stock has arrived; pack and mark each order ready for collection or dispatched separately.</p>
      {error && <p role="alert" className="mt-3 text-sm text-[#f0b8a8]">{error}</p>}
      <button disabled={busy || !changed} className="mt-4 min-h-12 rounded-lg bg-[#cbb79c] px-5 text-sm text-[#15120f] disabled:opacity-40">{busy ? "Saving…" : "Save & queue customer updates"}</button>
    </form>
  );
}
export default function PreordersSection() {
  const [data, setData] = useState<Result | null>(null), [query, setQuery] = useState("");
  const [version, setVersion] = useState(0), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true), [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError("");
    adminJson<Result>("/api/admin/preorders", { signal: abort.signal }).then(setData).catch((e) => { if (!abort.signal.aborted) setError(e.message || "Unable to load preorders."); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [version]);
  function saved(message: string) { setNotice(message); setVersion((v) => v + 1); }
  async function retry() {
    if (retrying) return; setRetrying(true); setError("");
    try { const result = await adminJson<{ message: string }>("/api/admin/preorders/emails/retry", { method: "POST" }); saved(result.message); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to retry emails."); }
    finally { setRetrying(false); }
  }
  const products = data?.products.filter((p) => [p.title, p.artist, p.variant, p.medium, String(p.id)].join(" ").toLowerCase().includes(query.toLowerCase())) || [];
  return (
    <section aria-labelledby="preorders-title">
      <h2 id="preorders-title" className="font-marcellus text-3xl">Preorders</h2>
      <p className="mt-3 text-sm leading-7 text-[#c0b4a3]">Track incoming titles here. Mixed orders stay on hold until every preorder is Ready. Changing a status or arrival date queues a customer update. No changes means no extra email.</p>
      <div className="my-5 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Find a preorder<input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Artist, title, format or product ID" /></label><button className="min-h-12 rounded-lg border border-white/20 px-4 text-sm" onClick={() => setVersion((v) => v + 1)}>Refresh</button></div>
      {notice && <p role="status" className="mb-4 text-sm text-[#cbb79c]">{notice}</p>}
      {error && <p role="alert" className="mb-4 text-sm text-[#f0b8a8]">{error}</p>}
      {!!data?.failedEmails && <div className="mb-5 rounded-lg border border-[#cbb79c]/30 p-4 text-sm"><p>{data.failedEmails} failed preorder email(s). Check Gmail settings if this persists.</p><button disabled={retrying} onClick={retry} className="mt-3 min-h-11 underline disabled:opacity-40">Retry failed preorder emails</button></div>}
      {loading ? <p role="status">Loading preorders…</p> : !error && !products.length ? <p className="rounded-lg border border-white/10 p-6 text-sm text-[#c0b4a3]">{query ? "No matching preorders." : "No preorders yet. Add the Preorder tag to a listing first."}</p> : <div className="space-y-5">{products.map((p) => <Editor key={`${p.id}-${p.preorderVersion}`} product={p} saved={saved} />)}</div>}
    </section>
  );
}
