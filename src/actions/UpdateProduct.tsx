import useUnsavedChanges from "../admin/useUnsavedChanges";
import { useEffect, useState, type FormEvent } from "react";
import type { Product } from "../scripts/product";
import { adminJson } from "../admin/adminApi";
import ProductFields from "../admin/ProductFields";
import {
  adminButton,
  adminField,
  adminPanel,
  productForm,
  productPayload,
  type ProductForm,
} from "../admin/productForm";
import { formatPrice, getPriceCents } from "../cart/cartStorage";
export default function UpdateProductSection() {
  const [result, setResult] = useState<{
      attempt: number;
      products?: Product[];
      error?: string;
    }>({ attempt: -1 }),
    [attempt, setAttempt] = useState(0),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(30),
    [selected, setSelected] = useState<Product | null>(null),
    [form, setForm] = useState<ProductForm | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    adminJson<Product[]>("/api/stock?inventory=on-hand", {
      signal: controller.signal,
    })
      .then((products) => setResult({ attempt, products }))
      .catch((err) => {
        if (!controller.signal.aborted)
          setResult({ attempt, error: err.message });
      });
    return () => controller.abort();
  }, [attempt]);
  useUnsavedChanges(
    Boolean(
      form &&
      selected &&
      JSON.stringify(form) !== JSON.stringify(productForm(selected)),
    ),
  );
  const products = result.products || [];
  const matches = products.filter((p) =>
    `${p.title} ${p.artist} ${p.barcode || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  function select(product: Product) {
    setSelected(product);
    setForm(productForm(product));
    setMessage("");
    setFailed(false);
  }
  function back() {
    if (busy) return;
    if (
      form &&
      selected &&
      JSON.stringify(form) !== JSON.stringify(productForm(selected)) &&
      !window.confirm("Discard your unsaved changes?")
    )
      return;
    setSelected(null);
    setForm(null);
    setMessage("");
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form || !selected || busy) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const saved = await adminJson<Product>(`/api/stock/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productPayload(form),
          expectedStock: Number(selected.stock),
        }),
      });
      setSelected(saved);
      setForm(productForm(saved));
      setResult((current) => ({
        ...current,
        products: current.products?.map((p) => (p.id === saved.id ? saved : p)),
      }));
      setMessage("Changes saved.");
    } catch (err) {
      setFailed(true);
      setMessage(
        err instanceof Error ? err.message : "Unable to save this record.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reloadSelected() {
    if (
      !selected ||
      busy ||
      !window.confirm("Reload the latest record and discard unsaved edits?")
    )
      return;
    setBusy(true);
    try {
      const saved = await adminJson<Product>(
        `/api/stock/${selected.id}?inventory=on-hand`,
      );
      setSelected(saved);
      setForm(productForm(saved));
      setResult((current) => ({
        ...current,
        products: current.products?.map((product) =>
          product.id === saved.id ? saved : product,
        ),
      }));
      setFailed(false);
      setMessage("Latest record loaded.");
    } catch (err) {
      setFailed(true);
      setMessage(err instanceof Error ? err.message : "Unable to reload.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !selected ||
      busy ||
      !window.confirm(
        `Delete “${selected.title}”? This permanently removes the listing. Existing orders may still need it.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await adminJson(`/api/stock/${selected.id}`, { method: "DELETE" });
      setResult((current) => ({
        ...current,
        products: current.products?.filter((p) => p.id !== selected.id),
      }));
      setSelected(null);
      setForm(null);
      setFailed(false);
      setMessage("Listing deleted.");
    } catch (err) {
      setFailed(true);
      setMessage(
        err instanceof Error ? err.message : "Unable to delete this record.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="edit-title">
      <header className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
          Keep the crates in order
        </p>
        <h2 id="edit-title" className="font-marcellus text-2xl sm:text-3xl">
          Edit records
        </h2>
      </header>
      {selected && form ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={back}
              className={adminButton}
            >
              ← All records
            </button>
            <span className="text-xs text-[#c0b4a3]">
              Listing #{selected.id}
            </span>
          </div>
          <div className="mb-5 flex min-w-0 items-center gap-3">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-[#28231d] text-[#cbb79c]">
              {selected.cover_image ? (
                <img
                  src={selected.cover_image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                "♪"
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-[#c0b4a3]">
                {selected.artist}
              </p>
              <h3 className="truncate font-marcellus text-lg">
                {selected.title}
              </h3>
            </div>
          </div>
          <form onSubmit={save}>
            <fieldset disabled={busy} className="min-w-0">
              <ProductFields value={form} onChange={setForm} />
            </fieldset>
            <div className="sticky bottom-0 z-20 mt-5 rounded-t-xl border-t border-white/15 bg-[#15120f]/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:rounded-xl sm:border">
              <p
                role={failed ? "alert" : "status"}
                className={`mb-2 text-sm empty:hidden ${failed ? "text-[#f0b8a8]" : "text-[#cbb79c]"}`}
              >
                {message}
              </p>
              {failed && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={reloadSelected}
                  className={`${adminButton} mb-3 w-full`}
                >
                  Reload latest record
                </button>
              )}
              <button
                type="submit"
                disabled={busy}
                className={`${adminButton} w-full bg-[#cbb79c] text-[#15120f]`}
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
          <details className="mt-6 rounded-xl border border-white/10 p-4">
            <summary className="min-h-11 cursor-pointer text-sm text-[#c0b4a3]">
              Remove this listing
            </summary>
            <p className="my-3 text-xs text-[#c0b4a3]">
              Deleting a listing does not cancel existing orders.
            </p>
            <button
              disabled={busy}
              onClick={remove}
              className={`${adminButton} text-[#f0b8a8]`}
            >
              Delete listing
            </button>
          </details>
        </>
      ) : (
        <>
          <label className="mb-4 block text-sm text-[#c0b4a3]">
            Find a record
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(30);
              }}
              className={adminField}
              placeholder="Artist, album or barcode…"
            />
          </label>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-[#c0b4a3]">{matches.length} records</p>
            <button
              onClick={() => setAttempt((v) => v + 1)}
              className={adminButton}
            >
              Refresh
            </button>
          </div>
          {message && (
            <p
              role={failed ? "alert" : "status"}
              className="mb-3 text-sm text-[#cbb79c]"
            >
              {message}
            </p>
          )}
          {result.attempt !== attempt ? (
            <p role="status" className="py-6 text-sm text-[#c0b4a3]">
              Loading records…
            </p>
          ) : result.error ? (
            <div role="alert" className={adminPanel}>
              <p className="text-sm text-[#f0b8a8]">{result.error}</p>
              <button
                onClick={() => setAttempt((v) => v + 1)}
                className={`${adminButton} mt-3`}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {matches.slice(0, limit).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => select(product)}
                    className="flex min-h-20 w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#211b16]/95 p-3 text-left hover:border-[#cbb79c]/50"
                  >
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-[#28231d] text-[#cbb79c]">
                      {product.cover_image ? (
                        <img
                          src={product.cover_image}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        "♪"
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-[#c0b4a3]">
                        {product.artist}
                      </span>
                      <span className="line-clamp-2 font-marcellus text-base">
                        {product.title}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-[#c0b4a3]">
                        {product.medium} · {product.stock} on hand
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-[#cbb79c]">
                      {formatPrice(getPriceCents(product.price) || 0)}
                      <span
                        className="mt-1 block text-right"
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!matches.length && (
                <p className={`${adminPanel} text-sm text-[#c0b4a3]`}>
                  No matching records.
                </p>
              )}
              {matches.length > limit && (
                <button
                  onClick={() => setLimit((v) => v + 30)}
                  className={`${adminButton} mt-4 w-full`}
                >
                  Show more records
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
