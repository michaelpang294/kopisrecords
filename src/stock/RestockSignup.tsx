import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell } from "lucide-react";
import { API } from "../api";

type Props = { productId: number; onAvailable: () => void };
export default function RestockSignup({ productId, onAvailable }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || saved) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setAvailable(false);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(`${API}/api/restock-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, email: email.trim() }),
        signal: abort.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "AVAILABLE") setAvailable(true);
        throw Error(result.error || "Unable to save your alert. Please try again.");
      }
      setSaved(true);
      setEmail("");
    } catch (err) {
      if (!abort.signal.aborted)
        setError(err instanceof Error ? err.message : "Unable to save your alert. Please try again.");
    } finally {
      busyRef.current = false;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const button = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[#cbb79c]/50 px-4 py-3 text-sm text-[#cbb79c] transition-colors hover:bg-[#cbb79c]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4 disabled:opacity-50";
  return (
    <section id="restock-alert" aria-label="Back-in-stock alert" className="mt-4 border-t border-white/10 pt-4 lg:mt-5 lg:pt-5">
      {saved ? (
        <div role="status" className="rounded-md border border-[#cbb79c]/30 bg-[#cbb79c]/5 p-4">
          <p className="m-0 text-sm text-[#efe8dc]">You’re on the list.</p>
          <p className="mb-0 mt-2 text-xs leading-relaxed text-[#c0b4a3]">We’ll email you once when this record is available again.</p>
        </div>
      ) : (
        <>
          <button type="button" aria-expanded={open} aria-controls={`restock-form-${productId}`} onClick={() => setOpen((v) => !v)} className={button}>
            <Bell size={16} aria-hidden="true" />
            Notify me when available
          </button>
          {open && (
            <form id={`restock-form-${productId}`} onSubmit={subscribe} className="mt-4 space-y-3">
              <label className="flex flex-col gap-2 text-sm text-[#efe8dc]">
                Email address
                <input name="restockEmail" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} aria-describedby={`restock-help-${productId}`} className="min-h-12 w-full min-w-0 rounded-md border border-white/20 bg-[#15120f] px-3 py-3 text-base text-[#efe8dc] outline-none focus:border-[#cbb79c]" />
              </label>
              <p id={`restock-help-${productId}`} className="m-0 text-xs leading-relaxed text-[#c0b4a3]">We’ll use your email to send one availability alert for this record.</p>
              <button disabled={busy} className={`${button} bg-[#cbb79c] text-[#15120f]! hover:bg-[#dfcdb3]`}>
                {busy ? "Saving…" : "Email me when it’s back"}
              </button>
              {error && <p role="alert" className="m-0 text-xs leading-relaxed text-[#f0b8a8]">{error}</p>}
              {available && <button type="button" onClick={onAvailable} className={button}>Check availability</button>}
            </form>
          )}
        </>
      )}
    </section>
  );
}
