import useUnsavedChanges from "../admin/useUnsavedChanges";
import { useEffect, useState } from "react";
import type { Product } from "../scripts/product";
import { adminJson } from "../admin/adminApi";
import { adminButton, adminField, adminPanel } from "../admin/productForm";
export default function StockLevelsSection() {
  const [result, setResult] = useState<{
      attempt: number;
      products?: Product[];
      error?: string;
    }>({ attempt: -1 }),
    [attempt, setAttempt] = useState(0),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(30),
    [dirty, setDirty] = useState<Record<number, string>>({}),
    [errors, setErrors] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    adminJson<Product[]>("/api/stock?inventory=on-hand", {
      signal: abort.signal,
    })
      .then((products) => setResult({ attempt, products }))
      .catch((err) => {
        if (!abort.signal.aborted) setResult({ attempt, error: err.message });
      });
    return () => abort.abort();
  }, [attempt]);
  const products = result.products || [],
    matches = products.filter((p) =>
      `${p.title} ${p.artist} ${p.barcode || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ),
    count = Object.keys(dirty).length;
  useUnsavedChanges(count > 0);
  function change(product: Product, value: string) {
    setMessage("");
    setErrors((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
    setDirty((current) => {
      const next = { ...current };
      if (value === String(product.stock)) delete next[product.id];
      else next[product.id] = value;
      return next;
    });
  }
  async function save() {
    if (busy || !count) return;
    const invalid: Record<number, string> = {};
    for (const [id, value] of Object.entries(dirty))
      if (!/^\d+$/.test(value) || Number(value) > 4294967295)
        invalid[Number(id)] = "Enter a whole number of zero or more.";
    if (Object.keys(invalid).length) {
      setErrors(invalid);
      setMessage("Check the highlighted quantities before saving.");
      return;
    }
    setBusy(true);
    setMessage("");
    const entries = Object.entries(dirty),
      successes: Product[] = [],
      failures: Record<number, string> = {};
    for (let offset = 0; offset < entries.length; offset += 4) {
      await Promise.all(
        entries.slice(offset, offset + 4).map(async ([id, value]) => {
          const original = products.find((p) => p.id === Number(id));
          if (!original) {
            failures[Number(id)] = "Record not found. Refresh the list.";
            return;
          }
          try {
            const saved = await adminJson<Product>(`/api/admin/stock/${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stock: Number(value),
                expectedStock: Number(original.stock),
              }),
            });
            successes.push(saved);
          } catch (err) {
            failures[Number(id)] =
              err instanceof Error ? err.message : "Unable to save.";
          }
        }),
      );
    }
    setResult((current) => ({
      ...current,
      products: current.products?.map(
        (product) =>
          successes.find((saved) => saved.id === product.id) || product,
      ),
    }));
    setDirty((current) => {
      const next = { ...current };
      for (const saved of successes) delete next[saved.id];
      return next;
    });
    setErrors(failures);
    setMessage(
      Object.keys(failures).length
        ? `${successes.length} saved. ${Object.keys(failures).length} need attention; their changes are still here.`
        : `${successes.length} ${successes.length === 1 ? "record" : "records"} updated.`,
    );
    setBusy(false);
  }
  function refresh() {
    if (count && !window.confirm("Discard unsaved stock changes and refresh?"))
      return;
    setDirty({});
    setErrors({});
    setAttempt((v) => v + 1);
    setMessage("");
  }
  return (
    <section aria-labelledby="stock-title">
      <header className="mb-5">
        <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
          A quick crate count
        </p>
        <h2 id="stock-title" className="font-marcellus text-2xl sm:text-3xl">
          Stock levels
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#c0b4a3]">
          Adjust physical copies on hand, including reserved copies. Save a few
          changes together.
        </p>
      </header>
      <label className="block text-sm text-[#c0b4a3]">
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
      <div className="my-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#c0b4a3]">
          {matches.length} records · {count} unsaved
        </p>
        <button disabled={busy} onClick={refresh} className={adminButton}>
          Refresh
        </button>
      </div>
      {result.attempt !== attempt ? (
        <p role="status" className="py-6 text-sm text-[#c0b4a3]">
          Loading stock…
        </p>
      ) : result.error ? (
        <div role="alert" className={adminPanel}>
          <p className="text-sm text-[#f0b8a8]">{result.error}</p>
          <button onClick={refresh} className={`${adminButton} mt-3`}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {matches.slice(0, limit).map((product) => {
              const value = dirty[product.id] ?? String(product.stock),
                changed = product.id in dirty;
              return (
                <article
                  key={product.id}
                  className={`rounded-xl border bg-[#211b16]/95 p-3 sm:p-4 ${changed ? "border-[#cbb79c]/50" : "border-white/10"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-[#28231d] text-[#cbb79c]">
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
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-[#c0b4a3]">
                        {product.artist}
                      </p>
                      <h3 className="line-clamp-2 font-marcellus text-base">
                        {product.title}
                      </h3>
                      <p className="mt-1 truncate text-[11px] text-[#c0b4a3]">
                        {[product.medium, product.variant]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {changed && (
                      <span className="text-[10px] text-[#cbb79c]">
                        Unsaved
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <label
                      htmlFor={`stock-${product.id}`}
                      className="text-xs text-[#c0b4a3]"
                    >
                      On hand
                      {changed && (
                        <span className="mt-1 block text-[10px]">
                          Was {product.stock}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center overflow-hidden rounded-lg border border-white/15 bg-[#15120f]">
                      <button
                        disabled={busy || Number(value) <= 0}
                        onClick={() =>
                          change(
                            product,
                            String(Math.max(0, (Number(value) || 0) - 1)),
                          )
                        }
                        aria-label={`Decrease stock of ${product.title}`}
                        className="grid size-12 place-items-center text-xl text-[#cbb79c] disabled:opacity-30"
                      >
                        −
                      </button>
                      <input
                        id={`stock-${product.id}`}
                        aria-label={`Stock for ${product.title}`}
                        aria-invalid={Boolean(errors[product.id])}
                        aria-describedby={
                          errors[product.id]
                            ? `stock-error-${product.id}`
                            : undefined
                        }
                        disabled={busy}
                        value={value}
                        inputMode="numeric"
                        pattern="[0-9]+"
                        onChange={(e) => change(product, e.target.value)}
                        className="h-12 w-16 min-w-0 bg-transparent text-center text-base tabular-nums outline-none focus:bg-[#cbb79c]/10"
                      />
                      <button
                        disabled={busy}
                        onClick={() =>
                          change(product, String((Number(value) || 0) + 1))
                        }
                        aria-label={`Increase stock of ${product.title}`}
                        className="grid size-12 place-items-center text-xl text-[#cbb79c] disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {errors[product.id] && (
                    <p
                      id={`stock-error-${product.id}`}
                      role="alert"
                      className="mt-3 text-xs leading-relaxed text-[#f0b8a8]"
                    >
                      {errors[product.id]}
                    </p>
                  )}
                </article>
              );
            })}
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
      <div className="sticky bottom-0 z-20 mt-5 rounded-t-xl border-t border-white/15 bg-[#15120f]/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:rounded-xl sm:border">
        {message && (
          <p role="status" className="mb-3 text-sm text-[#cbb79c]">
            {message}
          </p>
        )}
        <div className="flex gap-2">
          <button
            disabled={busy || !count}
            onClick={save}
            className={`${adminButton} flex-1 bg-[#cbb79c] text-[#15120f]`}
          >
            {busy
              ? "Saving…"
              : count
                ? `Save changes (${count})`
                : "All changes saved"}
          </button>
          {count > 0 && (
            <button
              disabled={busy}
              onClick={() => {
                if (window.confirm("Discard all unsaved stock changes?")) {
                  setDirty({});
                  setErrors({});
                  setMessage("");
                }
              }}
              className={adminButton}
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
