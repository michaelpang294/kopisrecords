import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API } from "../api";
import Footer from "../footer";

export default function StockAlertPage() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token") || "";
  const valid = /^[a-f0-9]{64}$/.test(token);
  const [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState("");
  const busyRef = useRef(false);
  async function confirm() {
    if (!valid || busyRef.current || confirmed) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/api/restock-alerts/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Unable to confirm this alert.");
      setConfirmed(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to confirm this alert."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <>
    <main id="main-content" className="min-h-[65vh] bg-[#15120f] px-4 py-12 font-[Arial,sans-serif] text-[#efe8dc] sm:py-20">
      <section className="mx-auto max-w-xl rounded-xl border border-white/10 bg-[#211b16] p-6 sm:p-9">
        <p className="m-0 text-xs uppercase tracking-widest text-[#cbb79c]">Back in the crates</p>
        <h1 className="mb-5 mt-4 font-marcellus text-3xl sm:text-4xl">{confirmed ? "Your alert is confirmed." : "Confirm your stock alert"}</h1>
        {!valid ? <p role="alert" className="text-sm leading-relaxed text-[#c0b4a3]">This link is incomplete. Open the full link in your confirmation email.</p> : confirmed ? <p role="status" className="text-sm leading-relaxed text-[#c0b4a3]">We’ll email you once when this record is available. Thanks for having a dig with us!</p> : <>
          <p className="text-sm leading-relaxed text-[#c0b4a3]">Press below to confirm your email and activate your one-time availability alert for this record.</p>
          <button onClick={confirm} disabled={busy} className="mt-4 min-h-12 w-full rounded-md bg-[#cbb79c] px-4 py-3 text-sm text-[#15120f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#cbb79c] disabled:opacity-50">{busy ? "Confirming…" : "Confirm stock alert"}</button>
          {error && <p role="alert" className="mt-4 text-sm leading-relaxed text-[#f0b8a8]">{error}</p>}
        </>}
        <Link to="/shop" className="mt-6 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline underline-offset-4">Back to the shop ↗</Link>
      </section>
    </main>
    <Footer />
  </>;
}
