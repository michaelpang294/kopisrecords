import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, Mail, Copy } from "lucide-react";
import { adminJson } from "./adminApi";
import useUnsavedChanges from "./useUnsavedChanges";
import { newCheckoutId } from "../orders/orderRecovery";
import { formatPrice } from "../cart/cartStorage";
import InvoiceItems from "../invoices/InvoiceItems";
import { invoiceDate, invoiceOrderLabel, type Invoice, type InvoiceDraft, type InvoiceLine } from "../invoices/invoiceTypes";
const field = "mt-2 block min-h-12 w-full rounded-lg border border-white/15 bg-[#15120f] px-3 py-3 text-base text-[#efe8dc] outline-none focus:border-[#cbb79c] disabled:opacity-60";
const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm hover:border-[#cbb79c] disabled:opacity-50 disabled:cursor-not-allowed";
const primary = button + " bg-[#cbb79c] text-[#15120f]";
const panel = "min-w-0 rounded-xl border border-white/10 bg-[#211b16]/95 p-4 sm:p-6";
const newLine = (): InvoiceLine => ({ key: newCheckoutId(), title: "", artist: "", unitPrice: "", quantity: 1, medium: "Vinyl", variant: "", cover_image: "" });
const newDraft = (): InvoiceDraft => ({ items: [newLine()], fulfilment: "collection", deliveryFee: "0.00", expiryDays: 7, customerName: "", email: "", notes: "", platform: "", externalReference: "", internalNotes: "" });
type List = { invoices: Invoice[]; total: number; page: number; pageSize: number };
type Preview = { subject: string; html: string; text: string; version: number };
const mailLabels: Record<string, string> = { not_queued: "Not sent", pending: "Queued", sending: "Sending", sent: "Sent", failed: "Delivery failed", skipped: "Not sent: invoice is no longer payable" };
const toItems = (draft: InvoiceDraft) => draft.items.map((i, n) => ({ ...i, id: -(n + 1), price: Math.round(Number(i.unitPrice || 0) * 100) }));
export default function InvoicesSection() {
  const [id, setId] = useState(newCheckoutId), [draft, setDraft] = useState(newDraft);
  const [selected, setSelected] = useState<Invoice | null>(null), [saved, setSaved] = useState(() => JSON.stringify(draft));
  const [step, setStep] = useState<1 | 2>(1), [preview, setPreview] = useState<Preview | null>(null);
  const [listResult, setListResult] = useState<{ key: string; data?: List; error?: string }>({ key: "" });
  const [q, setQ] = useState(""), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [privateLink, setPrivateLink] = useState(""), [voidConfirmed, setVoidConfirmed] = useState(false);
  const running = useRef(false), editor = useRef<HTMLDivElement>(null);
  const issued = Boolean(selected && selected.status !== "draft");
  const dirty = !issued && saved !== JSON.stringify(draft);
  useUnsavedChanges(dirty);
  const listKey = `/api/admin/invoices?status=${status}&q=${encodeURIComponent(query)}&page=${page}&refresh=${revision}`;
  const list = listResult.key === listKey ? listResult.data : undefined;
  const listError = listResult.key === listKey ? listResult.error : undefined;
  useEffect(() => {
    const controller = new AbortController();
    adminJson<List>(listKey, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setListResult({ key: listKey, data: value }); })
      .catch(err => { if (!controller.signal.aborted) setListResult({ key: listKey, error: err.message }); });
    return () => controller.abort();
  }, [listKey]);
  const pollingId = selected?.status === "sent" && ["pending", "sending"].includes(selected.emailStatus) ? selected.id : "";
  useEffect(() => {
    if (!pollingId) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      adminJson<Invoice>(`/api/admin/invoices/${pollingId}`, { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setSelected(old => old?.id === value.id ? value : old); })
        .catch(() => { /* Refresh remains available if an email-status poll fails. */ });
    }, 5000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [pollingId]);
  function change(value: InvoiceDraft) { setDraft(value); setPreview(null); setNotice(""); }
  function line(key: string, values: Partial<InvoiceLine>) { change({ ...draft, items: draft.items.map(i => i.key === key ? { ...i, ...values } : i) }); }
  function adopt(invoice: Invoice) {
    setSelected(invoice); setId(invoice.id); setDraft(invoice.draft); setSaved(JSON.stringify(invoice.draft));
    setPreview(null); setPrivateLink(""); setVoidConfirmed(false);
  }
  async function act(fn: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(""); setNotice("");
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save this invoice. Please try again."); }
    finally { running.current = false; setBusy(false); }
  }
  function canLeave() { return !dirty || window.confirm("You have unsaved invoice changes. Discard them?"); }
  function start(copy?: InvoiceDraft) {
    if (busy || !canLeave()) return;
    const next = copy ? { ...copy, items: copy.items.map(i => ({ ...i, key: newCheckoutId() })) } : newDraft();
    setSelected(null); setId(newCheckoutId()); setDraft(next); setSaved(copy ? "" : JSON.stringify(next));
    setStep(1); setPreview(null); setPrivateLink(""); setError(""); setNotice(""); setVoidConfirmed(false);
    editor.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  async function open(invoiceId: string) {
    if (!canLeave()) return;
    await act(async () => { adopt(await adminJson<Invoice>(`/api/admin/invoices/${invoiceId}`)); setStep(1); editor.current?.scrollIntoView({ block: "start", behavior: "smooth" }); });
  }
  async function save(): Promise<Invoice> {
    const value = await adminJson<Invoice>(selected ? `/api/admin/invoices/${id}` : "/api/admin/invoices", {
      method: selected ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected ? { version: selected.version, draft } : { id, draft }),
    });
    adopt(value); setRevision(v => v + 1); return value;
  }
  function records(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void act(async () => { await save(); setStep(2); });
  }
  function previewEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void act(async () => {
      const value = await save();
      setPreview(await adminJson<Preview>(`/api/admin/invoices/${value.id}/preview?version=${value.version}`));
      setNotice("Preview ready. Check the recipient, records and total before sending.");
    });
  }
  async function send() {
    if (!selected || !preview || preview.version !== selected.version || dirty) return;
    await act(async () => {
      const value = await adminJson<{ message: string; invoice: Invoice }>(`/api/admin/invoices/${id}/send`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: preview.version }),
      });
      adopt(await adminJson<Invoice>(`/api/admin/invoices/${value.invoice.id}`)); setNotice(value.message); setRevision(v => v + 1);
    });
  }
  async function link() {
    await act(async () => {
      const value = await adminJson<{ link: string }>(`/api/admin/invoices/${id}/link`, { method: "POST" });
      setPrivateLink(value.link);
      try { await navigator.clipboard.writeText(value.link); setNotice("Private payment link copied."); }
      catch { setNotice("Select and copy the private payment link below."); }
    });
  }
  async function voidInvoice() {
    if (!selected || !voidConfirmed) return;
    await act(async () => {
      const value = await adminJson<{ message: string }>(`/api/admin/invoices/${id}/void`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selected.version, confirmed: true }),
      });
      adopt(await adminJson<Invoice>(`/api/admin/invoices/${id}`)); setNotice(value.message); setRevision(v => v + 1);
    });
  }
  const items = toItems(draft);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0), delivery = draft.fulfilment === "delivery" ? Math.round(Number(draft.deliveryFee || 0) * 100) : 0;
  const summary = <>
    <InvoiceItems items={items} />
    <dl className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
      <div className="flex justify-between gap-2"><dt>Subtotal ({items.reduce((n, i) => n + i.quantity, 0)} items)</dt><dd>{formatPrice(subtotal)}</dd></div>
      <div className="flex justify-between gap-2"><dt>{draft.fulfilment === "delivery" ? "Delivery" : "Self collection"}</dt><dd>{delivery ? formatPrice(delivery) : "Free"}</dd></div>
      <div className="flex justify-between gap-2 border-t border-white/10 pt-4 text-lg"><dt>Total</dt><dd>{formatPrice(subtotal + delivery)}</dd></div>
    </dl>
  </>;
  const detailsField = (key: "customerName" | "email" | "platform" | "externalReference", label: string, required = false) => <label className="block text-sm" key={key}>{label}<input className={field} type={key === "email" ? "email" : "text"} required={required} maxLength={key === "email" ? 254 : key === "platform" ? 80 : 120} value={draft[key]} onChange={e => change({ ...draft, [key]: e.target.value })} /></label>;
  const canVoid = selected?.status === "draft" || (selected?.status === "sent" && ["awaiting_payment_confirmation", "expired", "cancelled"].includes(selected.orderStatus || ""));
  return <section aria-labelledby="invoices-title">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">Beyond the website</p><h2 id="invoices-title" className="font-marcellus text-2xl sm:text-3xl">Create invoice</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-[#c0b4a3]">Bill custom orders from Carousell, Telegram or anywhere else. Add your records, review the email, then send a private PayNow link.</p></div>
      <button type="button" disabled={busy} onClick={() => start()} className={primary}><Plus size={17} aria-hidden="true" />New invoice</button>
    </header>
    <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className={panel} aria-label="Saved invoices">
        <h3 className="font-marcellus text-xl">Your invoices</h3>
        <form className="mt-4" onSubmit={e => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
          <label className="text-xs text-[#c0b4a3]">Search name, email or reference<input type="search" className={field} maxLength={120} value={q} onChange={e => setQ(e.target.value)} /></label>
          <button className={`${button} mt-2 w-full`}>Search</button>
        </form>
        <label className="mt-4 block text-xs text-[#c0b4a3]">Status<select className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All invoices</option><option value="draft">Drafts</option><option value="sent">Issued</option><option value="void">Voided</option></select></label>
        <button type="button" onClick={() => setRevision(v => v + 1)} className="mt-2 min-h-11 text-xs text-[#cbb79c] underline">Refresh list</button>
        {listError && <p role="alert" className="mt-3 text-sm text-[#f0b8a8]">{listError}</p>}
        {!list && !listError && <p className="mt-3 text-sm" role="status">Loading invoices…</p>}
        {list && <p className="my-3 text-xs text-[#c0b4a3]">{list.total} invoice{list.total === 1 ? "" : "s"}</p>}
        <div className="max-h-[480px] space-y-2 overflow-auto xl:max-h-[800px]">
          {list?.invoices.map(i => <button key={i.id} disabled={busy} type="button" aria-pressed={selected?.id === i.id} onClick={() => void open(i.id)} className={`w-full rounded-lg border p-3 text-left disabled:opacity-50 ${selected?.id === i.id ? "border-[#cbb79c]" : "border-white/10"}`}>
            <span className="block break-all text-xs text-[#cbb79c]">{i.reference}</span>
            <span className="mt-2 block truncate text-sm">{i.draft.customerName || i.draft.email || "Unnamed draft"}</span>
            <span className="mt-1 block text-xs text-[#c0b4a3]">{formatPrice(i.totals.total)} · {i.status === "draft" ? "Draft" : i.status === "void" ? "Voided" : invoiceOrderLabel[i.orderStatus || ""] || "Issued"}</span>
            {i.draft.platform && <span className="mt-1 block truncate text-xs text-[#c0b4a3]">{i.draft.platform}</span>}
            {i.status === "sent" && <span className={`mt-2 block text-xs ${i.emailStatus === "failed" ? "text-[#f0b8a8]" : "text-[#cbb79c]"}`}>Email: {mailLabels[i.emailStatus] || i.emailStatus}</span>}
          </button>)}
        </div>
        {list && list.total > list.pageSize && <div className="mt-4 flex justify-between gap-2"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={button}>←</button><span className="self-center text-xs">Page {page}</span><button disabled={page * list.pageSize >= list.total} onClick={() => setPage(p => p + 1)} className={button}>→</button></div>}
      </aside>
      <div ref={editor} className={`${panel} scroll-mt-48 lg:scroll-mt-24`}>
        <p className="mb-3 break-all text-xs text-[#cbb79c]">{selected ? selected.reference : "New invoice · not sent"}{dirty ? " · Unsaved changes" : ""}</p>
        {error && <p role="alert" className="mb-4 rounded-lg border border-[#f0b8a8]/30 p-3 text-sm text-[#f0b8a8]">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-[#cbb79c]/30 p-3 text-sm text-[#cbb79c]">{notice}</p>}
        {!issued ? <>
          <ol className="mb-6 flex flex-wrap gap-3 text-xs text-[#c0b4a3]" aria-label="Invoice steps"><li className={step === 1 ? "text-[#efe8dc]" : ""}>1. Add records</li><li aria-hidden="true">→</li><li className={step === 2 ? "text-[#efe8dc]" : ""}>2. Review & email</li></ol>
          {step === 1 ? <form onSubmit={records}>
            <fieldset disabled={busy} className="min-w-0">
              <h3 className="font-marcellus text-2xl">What’s in the order?</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#c0b4a3]">These are manual records. Website listings and stock will stay unchanged; set aside the physical copies yourself.</p>
              <div className="mt-5 space-y-5">
                {draft.items.map((item, index) => <section key={item.key} className="rounded-xl border border-white/10 bg-[#15120f]/40 p-4" aria-label={`Record ${index + 1}`}>
                  <div className="mb-4 flex items-center justify-between gap-3"><h4 className="text-sm text-[#cbb79c]">Record {index + 1}</h4><button type="button" disabled={draft.items.length === 1} onClick={() => change({ ...draft, items: draft.items.filter(i => i.key !== item.key) })} className="inline-flex min-h-11 items-center gap-2 text-xs text-[#f0b8a8] disabled:opacity-40" aria-label={`Remove record ${index + 1}`}><Trash2 size={15} aria-hidden="true" />Remove</button></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">Album name<input className={field} required maxLength={255} value={item.title} onChange={e => line(item.key, { title: e.target.value })} /></label>
                    <label className="block text-sm">Artist<input className={field} required maxLength={255} value={item.artist} onChange={e => line(item.key, { artist: e.target.value })} /></label>
                    <label className="block text-sm">Unit price (S$)<input type="number" min="0" max="200000" step="0.01" inputMode="decimal" className={field} required value={item.unitPrice} onChange={e => line(item.key, { unitPrice: e.target.value })} /></label>
                    <label className="block text-sm">Quantity<input type="number" min="1" max="100" step="1" inputMode="numeric" className={field} required value={item.quantity} onChange={e => line(item.key, { quantity: Number(e.target.value) })} /></label>
                    <label className="block text-sm">Format<input list="invoice-formats" className={field} required maxLength={30} value={item.medium} onChange={e => line(item.key, { medium: e.target.value })} /></label>
                    <label className="block text-sm">Variant / pressing<input className={field} maxLength={255} placeholder="e.g. 2LP, red vinyl, 2026 pressing" value={item.variant} onChange={e => line(item.key, { variant: e.target.value })} /></label>
                    <label className="block text-sm sm:col-span-2">Cover image URL (optional)<input className={field} maxLength={2048} placeholder="https://…" value={item.cover_image} onChange={e => line(item.key, { cover_image: e.target.value })} /><span className="mt-2 block text-xs text-[#c0b4a3]">Use a publicly accessible image link, as you do when adding a website record.</span></label>
                    {/^https?:\/\//i.test(item.cover_image) && <img src={item.cover_image} alt={`${item.title || "Record"} cover preview`} referrerPolicy="no-referrer" className="size-24 rounded object-contain" />}
                  </div>
                </section>)}
              </div>
              <datalist id="invoice-formats"><option value="Vinyl" /><option value="CD" /><option value="Cassette" /></datalist>
              <button type="button" disabled={draft.items.length >= 100} onClick={() => change({ ...draft, items: [...draft.items, newLine()] })} className={`${button} mt-4`}><Plus size={16} aria-hidden="true" />Add another record</button>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">Fulfilment<select className={field} value={draft.fulfilment} onChange={e => change({ ...draft, fulfilment: e.target.value as InvoiceDraft["fulfilment"], deliveryFee: e.target.value === "delivery" ? "4.50" : "0.00" })}><option value="collection">Self collection</option><option value="delivery">Delivery</option></select></label>
                <label className="block text-sm">Payment link expires after<select className={field} value={draft.expiryDays} onChange={e => change({ ...draft, expiryDays: Number(e.target.value) })}>{[1, 3, 7, 14, 30].map(n => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"}</option>)}</select><span className="mt-2 block text-xs text-[#c0b4a3]">Starts when the invoice is issued.</span></label>
                {draft.fulfilment === "delivery" && <label className="block text-sm">Delivery fee (S$)<input type="number" min="0" step="0.01" required className={field} value={draft.deliveryFee} onChange={e => change({ ...draft, deliveryFee: e.target.value })} /></label>}
                {detailsField("platform", "Sales platform (private, optional)")}
                {detailsField("externalReference", "Platform / deal reference (private, optional)")}
                <label className="block text-sm sm:col-span-2">Internal notes (private, optional)<textarea className={field} maxLength={2000} rows={3} value={draft.internalNotes} onChange={e => change({ ...draft, internalNotes: e.target.value })} /></label>
              </div>
            </fieldset>
            <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void act(async () => { await save(); setNotice("Draft saved. No email sent."); })} className={button}>Save draft</button><button disabled={busy} className={primary}>{busy ? "Saving…" : "Review & email →"}</button></div>
          </form> : <>
            <button type="button" disabled={busy} onClick={() => { setStep(1); setPreview(null); }} className={`${button} mb-5`}><ArrowLeft size={16} aria-hidden="true" />Edit records</button>
            <h3 className="font-marcellus text-2xl">Review your invoice</h3>
            {summary}
            <form onSubmit={previewEmail} className="mt-6">
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                {detailsField("customerName", "Customer name (optional)")}
                {detailsField("email", "Send invoice to", true)}
                <label className="block text-sm">Note to customer (optional)<textarea className={field} maxLength={2000} rows={3} value={draft.notes} onChange={e => change({ ...draft, notes: e.target.value })} /></label>
              </fieldset>
              <p className="mt-4 text-xs leading-relaxed text-[#c0b4a3]">The customer will confirm their name, contact number, Telegram and delivery address (if needed) before paying. This email goes only to the recipient above.</p>
              <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void act(async () => { await save(); setNotice("Draft saved. No email sent."); })} className={button}>Save draft</button><button disabled={busy} className={button}>{busy ? "Preparing…" : "Preview email"}</button></div>
            </form>
            {preview && <section className="mt-6 rounded-xl border border-white/15 p-4" aria-label="Email preview"><p className="text-xs uppercase tracking-wider text-[#cbb79c]">Email preview</p><p className="mt-3 break-all text-sm">To: {draft.email}</p><p className="mt-2 text-sm">Subject: {preview.subject}</p><p className="my-3 text-xs text-[#c0b4a3]">Preview link is a placeholder. A private payment link is created when the email sends.</p><iframe title="Invoice email preview" sandbox="" srcDoc={preview.html} className="h-[620px] w-full rounded-lg bg-white" /></section>}
            <div className="sticky bottom-0 mt-6 border-t border-white/15 bg-[#211b16] py-4"><button type="button" disabled={busy || !preview || dirty || preview.version !== selected?.version} onClick={() => void send()} className={`${primary} w-full break-all`}><Mail size={17} aria-hidden="true" />{busy ? "Sending…" : `Send invoice${draft.email ? ` to ${draft.email}` : ""}`}</button><p className="mt-3 text-xs leading-relaxed text-[#c0b4a3]">Preview the latest changes to enable sending. Issued invoices are locked to keep the bill and customer payment page consistent.</p></div>
          </>}
        </> : selected && <>
          <div className="flex flex-wrap justify-between gap-3"><h3 className="font-marcellus text-2xl">{selected.status === "void" ? "Voided invoice" : "Invoice issued"}</h3><span className="self-center rounded-full border border-white/20 px-3 py-1 text-xs">{invoiceOrderLabel[selected.orderStatus || ""] || "Closed"}</span></div>
          <p className="mt-4 break-words text-sm">{draft.customerName} {draft.email && <span className="text-[#c0b4a3]">· {draft.email}</span>}</p>
          <div className="my-5 rounded-lg border border-white/10 p-4 text-sm"><p>Email: <strong className={selected.emailStatus === "failed" ? "text-[#f0b8a8]" : "text-[#cbb79c]"}>{mailLabels[selected.emailStatus] || selected.emailStatus}</strong></p>{selected.emailSentAt && <p className="mt-2 text-xs text-[#c0b4a3]">{invoiceDate(selected.emailSentAt)}</p>}{selected.emailStatus === "failed" && <><p className="mt-3 text-xs leading-relaxed text-[#c0b4a3]">The invoice is saved. We’ll retry delivery automatically up to 5 attempts. Check Gmail settings if failures continue. {selected.emailError && `Error: ${selected.emailError}`}</p><button type="button" disabled={busy} onClick={() => void act(async () => { const value = await adminJson<{ message: string }>(`/api/admin/invoices/${id}/email/retry`, { method: "POST" }); setNotice(value.message); setSelected(await adminJson<Invoice>(`/api/admin/invoices/${id}`)); })} className={`${button} mt-3`}>Retry failed email</button></>}{selected.emailStatus === "sending" && <p className="mt-3 text-xs leading-relaxed text-[#c0b4a3]">If this stays on Sending after a refresh, check Gmail’s Sent folder before sharing the link manually. This avoids sending duplicate bills.</p>}</div>
          {summary}
          {draft.notes && <p className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 p-4 text-sm">{draft.notes}</p>}
          {selected.expiresAt && <p className="mt-5 text-xs text-[#c0b4a3]">Payment link expires: {invoiceDate(selected.expiresAt)}</p>}
          <div className="mt-5 rounded-lg border border-white/10 p-4 text-sm"><p className="text-xs uppercase tracking-wider text-[#cbb79c]">Private shop notes</p><p className="mt-3">Platform: {draft.platform || "Not specified"}</p><p className="mt-2 break-words">Deal reference: {draft.externalReference || "Not specified"}</p><p className="mt-2 whitespace-pre-wrap text-[#c0b4a3]">{draft.internalNotes || "No internal notes."}</p></div>
          <p className="mt-5 text-xs leading-relaxed text-[#c0b4a3]">Custom invoice records don’t change website stock. Use Orders to verify payment, add a collection / bag number, mark dispatched or complete the order. To change an issued bill, duplicate it and void the old unpaid invoice.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link to={`/admin/orders?q=${encodeURIComponent(selected.reference)}`} className={primary}>Manage in Orders ↗</Link><button type="button" disabled={busy} onClick={() => start(draft)} className={button}><Copy size={16} aria-hidden="true" />Duplicate as draft</button>{selected.status === "sent" && !["cancelled", "expired"].includes(selected.orderStatus || "") && <button type="button" disabled={busy} onClick={() => void link()} className={button}>Copy private payment link</button>}<button type="button" disabled={busy} onClick={() => void act(async () => { setSelected(await adminJson<Invoice>(`/api/admin/invoices/${id}`)); setRevision(v => v + 1); })} className={button}>Refresh status</button></div>
          {privateLink && <label className="mt-4 block text-xs text-[#c0b4a3]">Private payment link<input className={field} value={privateLink} readOnly onFocus={e => e.target.select()} /></label>}
        </>}
        {selected && canVoid && <details className="mt-7 border-t border-white/10 pt-5"><summary className="cursor-pointer text-sm text-[#f0b8a8]">Void this invoice</summary><p className="mt-4 text-xs leading-relaxed text-[#c0b4a3]">Voiding closes the payment page. It does not refund a bank transfer. Invoices with reported or confirmed payments must be handled in Orders.</p><label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={voidConfirmed} onChange={e => setVoidConfirmed(e.target.checked)} className="mt-1 accent-[#cbb79c]" />I checked for payment and want to void this unpaid invoice.</label><button type="button" disabled={busy || !voidConfirmed || dirty} onClick={() => void voidInvoice()} className={`${button} mt-4 text-[#f0b8a8]`}>Void invoice</button>{dirty && <p className="mt-2 text-xs text-[#c0b4a3]">Save or discard unsaved edits first.</p>}</details>}
      </div>
    </div>
  </section>;
}
