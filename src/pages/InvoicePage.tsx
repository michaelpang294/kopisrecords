import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { API } from "../admin/adminApi";
import Footer from "../footer";
import { validToken, type RecoveredOrder } from "../orders/orderRecovery";
import { formatPrice } from "../cart/cartStorage";
import InvoiceItems from "../invoices/InvoiceItems";
import { invoiceDate } from "../invoices/invoiceTypes";
const field = "mt-2 min-h-12 w-full rounded-lg border border-white/15 bg-[#15120f] p-3 text-base outline-none focus:border-[#cbb79c]";
export default function InvoicePage() {
  const { hash } = useLocation(), navigate = useNavigate();
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token") || "";
  const [result, setResult] = useState<{ token: string; order?: RecoveredOrder; error?: string }>({ token: "" });
  const [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const submitting = useRef(false);
  const [form, setForm] = useState({ name: "", phone: "", telegram: "", address: "", postal: "" });
  const order = result.token === token ? result.order : undefined;
  useEffect(() => {
    const previous = document.title; document.title = "Your invoice | Kopi’s Records";
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (!validToken(token)) return;
    const controller = new AbortController();
    fetch(API + "/api/order-recovery", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal })
      .then(async res => {
        const value = await res.json();
        if (!res.ok) throw Error(value.error || "Unable to load this invoice.");
        if (value.source !== "invoice") throw Error("This is not an invoice link. Please use your order link instead.");
        if (!controller.signal.aborted) setResult({ token, order: value });
      }).catch(err => { if (!controller.signal.aborted) setResult({ token, error: err instanceof Error ? err.message : "Unable to load this invoice." }); });
    return () => controller.abort();
  }, [token, attempt]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(API + "/api/order-recovery/invoice-details", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const value = await response.json();
      if (!response.ok) throw Error(value.error || "Unable to save your details.");
      navigate(`/order#token=${token}`, { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (order && (order.invoiceDetailsConfirmed || !["awaiting_payment_confirmation", "expired", "cancelled"].includes(order.status)))
    return <Navigate to={`/order#token=${token}`} replace />;
  const closed = order && ["expired", "cancelled"].includes(order.status);
  const loadError = !validToken(token) ? "This invoice link is incomplete. Please use the full private link in your email." : result.token === token ? result.error : "";
  return <>
    <main id="main-content" className="min-h-screen bg-[#15120f] px-4 py-8 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6">
      <div className="mx-auto max-w-[1040px]">
        <Link to="/contact" className="inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline">Need a hand? Contact us ↗</Link>
        <p className="mt-5 text-xs uppercase tracking-[.18em] text-[#cbb79c]">Made for your collection</p>
        <h1 className="my-3 font-marcellus text-3xl sm:text-4xl">Your custom order</h1>
        <p className="mb-7 max-w-xl text-sm leading-relaxed text-[#c0b4a3]">Check your records, confirm your details, then continue to PayNow. There’s no need to add these records to your cart.</p>
        {loadError ? <div role="alert" className="rounded-xl border border-white/10 bg-[#211b16] p-5"><p>{loadError}</p><button onClick={() => setAttempt(v => v + 1)} className="mt-3 min-h-11 underline">Try again</button></div>
          : !order ? <p role="status">Loading your invoice…</p>
          : <div className="grid items-start gap-5 md:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-[#211b16] p-5 sm:p-6" aria-labelledby="invoice-summary-title">
              <h2 id="invoice-summary-title" className="font-marcellus text-2xl">Your records</h2>
              <p className="mt-3 break-all text-sm text-[#cbb79c]">Order: {order.reference}</p>
              <InvoiceItems items={order.items} />
              <dl className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between gap-3"><dt>Subtotal ({order.items.reduce((sum, i) => sum + i.quantity, 0)} items)</dt><dd>{formatPrice(order.subtotal)}</dd></div>
                <div className="flex justify-between gap-3"><dt>{order.fulfilment === "delivery" ? "Delivery" : "Self collection"}</dt><dd>{order.delivery ? formatPrice(order.delivery) : "Free"}</dd></div>
                <div className="flex justify-between gap-3 border-t border-white/10 pt-4 text-lg"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
              </dl>
              {order.customerNote && <p className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 p-3 text-sm text-[#c0b4a3]">{order.customerNote}</p>}
              {order.expiresAt && <p className="mt-5 text-xs text-[#c0b4a3]">Payment link expires: {invoiceDate(order.expiresAt)}</p>}
            </section>
            <section className="rounded-xl border border-white/10 bg-[#211b16] p-5 sm:p-6">
              {closed ? <><h2 className="font-marcellus text-2xl">This invoice is {order.status === "cancelled" ? "cancelled" : "expired"}</h2><p className="mt-4 text-sm leading-relaxed text-[#c0b4a3]">Please contact us for an updated invoice. If you have already transferred payment, send us your order reference. Please do not pay again.</p></>
                : <form onSubmit={submit}>
                  <h2 className="font-marcellus text-2xl">Confirm your details</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#c0b4a3]">Order updates will go to the email address this invoice was sent to. We’ll contact you on Telegram or by phone to arrange {order.fulfilment === "delivery" ? "delivery" : "collection"}.</p>
                  <fieldset disabled={busy} className="mt-5 min-w-0 space-y-4 text-sm">
                    <label className="block">Name<input className={field} name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="block">Contact number<input className={field} name="phone" type="tel" autoComplete="tel" required maxLength={40} placeholder="+65 9123 4567" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
                    <label className="block">Telegram username<input className={field} name="telegram" autoComplete="off" required maxLength={33} placeholder="@yourusername" value={form.telegram} onChange={e => setForm({ ...form, telegram: e.target.value })} /></label>
                    {order.fulfilment === "delivery" ? <>
                      <label className="block">Delivery address<textarea className={field} name="address" autoComplete="street-address" required maxLength={500} rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
                      <label className="block">Singapore postal code<input className={field} name="postal" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={form.postal} onChange={e => setForm({ ...form, postal: e.target.value })} /></label>
                    </> : <p className="rounded-lg border border-white/10 p-3 text-xs leading-relaxed text-[#c0b4a3]">Self collection at Rocks Cafe, 98 Arab Street, Level 2, Back Alley Entrance (199794). We’ll email you when your records are ready. Please wait for that email before heading down.</p>}
                  </fieldset>
                  {error && <p role="alert" className="mt-4 text-sm text-[#f0b8a8]">{error}</p>}
                  <button disabled={busy} className="mt-6 min-h-12 w-full rounded-lg bg-[#cbb79c] px-4 py-3 text-sm text-[#15120f] disabled:opacity-50">{busy ? "Saving…" : `Continue to payment · ${formatPrice(order.total)}`}</button>
                  <p className="mt-4 text-xs leading-relaxed text-[#c0b4a3]">Something doesn’t look right? Contact us before paying. Keep this link private.</p>
                </form>}
            </section>
          </div>}
      </div>
    </main>
    <Footer />
  </>;
}
