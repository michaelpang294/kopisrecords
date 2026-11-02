import useUnsavedChanges from "../admin/useUnsavedChanges";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { adminJson } from "../admin/adminApi";
import ProductFields from "../admin/ProductFields";
import {
  adminButton,
  emptyProduct,
  productPayload,
} from "../admin/productForm";
export default function CreateProductSection() {
  const [form, setForm] = useState(emptyProduct),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  useUnsavedChanges(JSON.stringify(form) !== JSON.stringify(emptyProduct()));
  function nextField(event: KeyboardEvent<HTMLFormElement>) {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    )
      return;
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ))
      return;
    // Keep button and checkbox keyboard behavior; don't submit via a checkbox.
    if (
      target instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(target.type)
    ) {
      event.preventDefault();
      return;
    }
    if (
      target instanceof HTMLInputElement &&
      ["submit", "button", "reset", "file", "hidden"].includes(target.type)
    )
      return;
    event.preventDefault();
    const fields = Array.from(
      event.currentTarget.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]), select, textarea',
      ),
    ).filter(
      (field) =>
        !field.matches(":disabled") &&
        !("readOnly" in field && field.readOnly) &&
        !field.closest("[hidden]"),
    );
    const index = fields.indexOf(target);
    const next = fields[index + (event.shiftKey ? -1 : 1)];
    if (!next) {
      if (!event.shiftKey)
        event.currentTarget
          .querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.focus();
      return;
    }
    // Reveal optional fields automatically so the complete form works by keyboard.
    let parent = next.parentElement;
    while (parent && parent !== event.currentTarget) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    next.focus();
    if (
      next instanceof HTMLInputElement &&
      ["text", "search", "url", "tel", "email", "password"].includes(next.type)
    )
      next.select();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    setFailed(false);
    setBusy(true);
    try {
      const body = productPayload(form);
      await adminJson("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setForm(emptyProduct());
      setMessage("Record created. Ready for the next one.");
    } catch (err) {
      setFailed(true);
      setMessage(
        err instanceof Error ? err.message : "Unable to create this record.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="create-title">
      <header className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
          Fresh in the crates
        </p>
        <h2 id="create-title" className="font-marcellus text-2xl sm:text-3xl">
          Create listing
        </h2>
        <p className="mt-2 text-sm text-[#c0b4a3]">
          Start with the essentials. Add pressing notes whenever you need.
        </p>
      </header>
      <form onSubmit={submit} onKeyDown={nextField}>
        <fieldset disabled={busy} className="min-w-0">
          <ProductFields value={form} onChange={setForm} newListing />
        </fieldset>
        <div className="sticky bottom-0 z-20 -mx-1 mt-5 rounded-t-xl border-t border-white/15 bg-[#15120f]/95 px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:rounded-xl sm:border sm:p-4">
          <p
            role={failed ? "alert" : "status"}
            className={`mb-2 text-sm empty:hidden ${failed ? "text-[#f0b8a8]" : "text-[#cbb79c]"}`}
          >
            {message}
          </p>
          <button
            type="submit"
            disabled={busy}
            className={`${adminButton} w-full bg-[#cbb79c] text-[#15120f] hover:bg-[#dfcdb3]`}
          >
            {busy ? "Creating…" : "Create listing ↗"}
          </button>
        </div>
      </form>
    </section>
  );
}
