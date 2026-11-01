import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Footer from "../footer";
import type { Product } from "../scripts/picksOfTheWeek";
import { typography as type } from "../styles/typography";
import shopBackground from "../assets/backgrounds/third-slide-bg.png";

const PAGE_SIZE = 50;
type TaggedProduct = Product & { tags: string[] };

const tagSortOptions = [
  { value: "newest", label: "Newest added", tag: "new_arrival" },
  { value: "recommended", label: "Recommended", tag: "recommended" },
  { value: "record_of_the_week", label: "Record of the week", tag: "record_of_the_week" },
  { value: "bestseller", label: "Best sellers", tag: "bestseller" },
  { value: "sale", label: "On sale", tag: "sale" },
] as const;

const tagLabels: Record<string, string> = {
  new_arrival: "New Arrival",
  record_of_the_week: "Record of the Week",
  recommended: "Recommended",
  bestseller: "Best Seller",
  sale: "On Sale",
};

// MySQL JSON fields may arrive as an array or as a JSON-encoded string.
function normaliseTags(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4";
const filterScrollbar = [
  "[scrollbar-width:thin]",
  "[scrollbar-color:#cbb79c55_transparent]",
  "hover:[scrollbar-color:#cbb79c99_transparent]",
  "[&::-webkit-scrollbar]:w-1.5",
  "[&::-webkit-scrollbar-track]:bg-transparent",
  "[&::-webkit-scrollbar-thumb]:rounded-full",
  "[&::-webkit-scrollbar-thumb]:bg-[#cbb79c55]",
  "[&::-webkit-scrollbar-thumb:hover]:bg-[#cbb79c99]",
].join(" ");
function money(value: number) {
  return Number.isFinite(value) ? `S$${value.toFixed(2)}` : "Price unavailable";
}

function splitGenres(product: Product) {
  return (product.genre || "")
    .split(/[,;|]/)
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function makeOptions(products: Product[], getValues: (p: Product) => string[]) {
  const counts = new Map<string, { value: string; label: string; count: number }>();

  for (const product of products) {
    const seen = new Set<string>();
    for (const raw of getValues(product)) {
      const label = raw.trim();
      const value = label.toLowerCase();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      const existing = counts.get(value);
      if (existing) existing.count += 1;
      else counts.set(value, { value, label, count: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open={title !== "Genre"} className="group border-b border-white/10 py-5 last:border-b-0">
      <summary
        className={`${type.ui} ${focus} flex cursor-pointer list-none items-center justify-between gap-3 text-[#efe8dc] [&::-webkit-details-marker]:hidden`}
      >
        {title}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-[#cbb79c] transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}

function RecordCard({ product }: { product: TaggedProduct }) {
  const [failed, setFailed] = useState(false);
  const inStock = Number(product.stock) > 0;
  const tags = [...new Set(product.tags)];

  return (
    <article className="min-w-0">
      <Link
        to={`/shop/product/${product.id}`}
        className={`${focus} group flex h-full flex-col rounded-sm text-[#efe8dc] no-underline`}
      >
        <div className="relative mb-4 aspect-square overflow-hidden bg-[#28231d]">
          {product.cover_image && !failed ? (
            <img
              src={product.cover_image}
              alt={`${product.artist} — ${product.title} cover`}
              loading="lazy"
              onError={() => setFailed(true)}
              className="block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
            />
          ) : (
            <div
              className="grid h-full place-items-center text-[#cbb79c]"
              role="img"
              aria-label="Cover unavailable"
            >
              <Disc3 size={52} strokeWidth={1} aria-hidden="true" />
            </div>
          )}

          {tags.length > 0 && (
            <ul
              aria-label="Record tags"
              className="pointer-events-none absolute inset-x-2 top-2 z-10 m-0 flex list-none flex-wrap items-start gap-1.5 p-0"
            >
              {tags.map((tag) => (
                <li
                  key={tag}
                  className={`${type.meta} max-w-full rounded-full border border-[#cbb79c]/20 bg-[#211b16]/80 px-2.5 py-0.5 text-left text-[#efe8dc] [overflow-wrap:anywhere]`}
                >
                  {tagLabels[tag] || tag.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          )}

          {!inStock && (
            <span
              className={`${type.meta} absolute bottom-2 left-2 bg-[#15120f]/95 px-2 py-1 text-[#efe8dc]`}
            >
              Sold out
            </span>
          )}
        </div>

        <p className={`${type.small} m-0 mb-1 text-[#c0b4a3] [overflow-wrap:anywhere]`}>
          {product.artist}
        </p>
        <h3
          className={`${type.itemTitle} m-0 mb-2 text-[#efe8dc] [overflow-wrap:anywhere]`}
        >
          {product.title}
        </h3>
        <p className={`${type.meta} m-0 mb-4 text-[#c0b4a3] [overflow-wrap:anywhere]`}>
          {[product.medium, product.variant].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-auto border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className={`${type.ui} text-[#efe8dc]`}>
              {money(Number(product.price))}
            </strong>
            <ArrowUpRight size={16} aria-hidden="true" className="text-[#cbb79c]" />
          </div>
          <p
            className={`${type.meta} m-0 mt-1 ${inStock ? "text-[#cbb79c]" : "text-[#c0b4a3]"}`}
          >
            {inStock ? "In stock" : "Sold out"}
          </p>
        </div>
      </Link>
    </article>
  );
}

export default function ShopPage() {
  const [params, setParams] = useSearchParams();
  const { query: routeQuery } = useParams<{ query: string }>();
  const [products, setProducts] = useState<TaggedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = params.get("q") ?? routeQuery ?? "";
  const genres = params.getAll("genre").map((value) => value.toLowerCase());
  const formats = params.getAll("format").map((value) => value.toLowerCase());
  const inStockOnly = (params.get("stock") ?? "in") === "in";
  const minValue = params.get("min") || "";
  const maxValue = params.get("max") || "";
  const sort = params.get("sort") || "default";

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    fetch("http://localhost:3001/api/stock", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Stock unavailable");
        return response.json();
      })
      .then((data: (Product & { tags?: unknown })[]) => {
        if (!Array.isArray(data)) throw new Error("Invalid stock data");
        setProducts(data.map((product) => ({ ...product, tags: normaliseTags(product.tags) })));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const genreOptions = useMemo(() => makeOptions(products, splitGenres), [products]);
  const formatOptions = useMemo(
    () => makeOptions(products, (product) => [product.medium || ""]),
    [products],
  );

  function updateParams(
    changes: Record<string, string | string[] | null>,
    resetPage = true,
    replace = false,
  ) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          next.delete(key);
          if (Array.isArray(value)) {
            value.forEach((item) => next.append(key, item));
          } else if (value !== null && (value !== "" || (key === "q" && routeQuery))) {
            next.set(key, value);
          }
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace },
    );
  }

  function toggleOption(key: "genre" | "format", value: string, checked: boolean) {
    const next = params
      .getAll(key)
      .filter((item) => item.toLowerCase() !== value.toLowerCase());
    if (checked) next.push(value);
    updateParams({ [key]: next });
  }

  function clearFilters() {
    updateParams({ q: "", genre: null, format: null, stock: "all", min: null, max: null });
  }

  const filtered = useMemo(() => {
    const search = (params.get("q") ?? routeQuery ?? "").trim().toLowerCase();
    const selectedGenres = params.getAll("genre").map((value) => value.toLowerCase());
    const selectedFormats = params.getAll("format").map((value) => value.toLowerCase());
    const minimum = params.get("min");
    const maximum = params.get("max");

    const result = products.filter((product) => {
      if (search) {
        const text = [product.title, product.artist, product.barcode, product.genre]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(search)) return false;
      }
      if ((params.get("stock") ?? "in") === "in" && Number(product.stock) <= 0) return false;
      if (
        selectedGenres.length &&
        !splitGenres(product).some((genre) =>
          selectedGenres.includes(genre.toLowerCase()),
        )
      )
        return false;
      if (
        selectedFormats.length &&
        !selectedFormats.includes((product.medium || "").trim().toLowerCase())
      )
        return false;
      const price = Number(product.price);
      if (
        minimum !== null &&
        minimum !== "" &&
        (!Number.isFinite(price) || price < Number(minimum))
      )
        return false;
      if (
        maximum !== null &&
        maximum !== "" &&
        (!Number.isFinite(price) || price > Number(maximum))
      )
        return false;
      return true;
    });

    const selectedSort = params.get("sort") || "default";
    const taggedSort = tagSortOptions.find((option) => option.value === selectedSort);

    if (taggedSort) {
      // Sort matching tags to the front without removing any other records.
      result.sort((a, b) => {
        const priority =
          Number(b.tags.includes(taggedSort.tag)) - Number(a.tags.includes(taggedSort.tag));
        if (priority !== 0) return priority;
        // Within each arrival group, keep the existing newest-ID ordering.
        return selectedSort === "newest" ? Number(b.id) - Number(a.id) : 0;
      });
      return result;
    }

    switch (selectedSort) {
      case "price-asc":
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "artist":
        result.sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
        break;
      case "title":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
    }
    return result;
  }, [products, params, routeQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(params.get("page") || "1", 10) || 1;
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const start = (page - 1) * PAGE_SIZE;
  const visibleProducts = filtered.slice(start, start + PAGE_SIZE);
  const filterCount =
    genres.length +
    formats.length +
    Number(inStockOnly) +
    Number(Boolean(minValue || maxValue));
  const hasFilters = filterCount > 0 || query.trim().length > 0;

  function goToPage(next: number) {
    updateParams({ page: String(Math.max(1, Math.min(totalPages, next))) }, false);
    document.getElementById("shop-results")?.scrollIntoView({ block: "start" });
  }

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (query.trim())
    chips.push({
      key: "query",
      label: `Search: ${query}`,
      remove: () => updateParams({ q: "" }),
    });
  if (inStockOnly)
    chips.push({
      key: "stock",
      label: "In stock",
      remove: () => updateParams({ stock: "all" }),
    });
  genres.forEach((value) =>
    chips.push({
      key: `genre-${value}`,
      label: genreOptions.find((item) => item.value === value)?.label || value,
      remove: () => toggleOption("genre", value, false),
    }),
  );
  formats.forEach((value) =>
    chips.push({
      key: `format-${value}`,
      label: formatOptions.find((item) => item.value === value)?.label || value,
      remove: () => toggleOption("format", value, false),
    }),
  );
  if (minValue || maxValue)
    chips.push({
      key: "price",
      label:
        minValue && maxValue
          ? `${money(Number(minValue))} – ${money(Number(maxValue))}`
          : minValue
            ? `From ${money(Number(minValue))}`
            : `Up to ${money(Number(maxValue))}`,
      remove: () => updateParams({ min: null, max: null }),
    });

  return (
    <div className={`${type.body} relative isolate min-h-screen bg-[#15120f] text-[#efe8dc]`}>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${shopBackground})` }}
      />
      <main
        id="main-content"
        className="mx-auto max-w-[1600px] px-[18px] pb-14 pt-7 sm:px-6 sm:pt-10 lg:px-10 lg:pb-20"
      >
        <nav
          aria-label="Breadcrumb"
          className={`${type.small} mb-8 flex items-center gap-3 text-[#c0b4a3]`}
        >
          <Link to="/" className={`${focus} hover:text-[#efe8dc]`}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#efe8dc]">
            Shop
          </span>
        </nav>
        <div className="relative mb-8 sm:mb-10">
          <Search
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#cbb79c]"
          />
          <input
            type="search"
            aria-label="Search artists, albums, genres or barcodes"
            placeholder="Search artists, albums, or barcodes…"
            value={query}
            onChange={(event) => updateParams({ q: event.target.value }, true, true)}
            className={`${type.body} min-h-14 w-full rounded-md border border-white/10 bg-[#211b16] py-3 pl-12 pr-4 text-[#15120F] placeholder:text-[#c0b4a3] focus:border-[#cbb79c] focus:outline-none focus:ring-2 focus:ring-[#cbb79c]/20`}
          />
        </div>

        <div className="mb-5 flex items-center justify-between border-y border-white/10 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            aria-controls="shop-filters"
            className={`${type.ui} ${focus} inline-flex min-h-11 items-center gap-3 rounded-md border border-white/15 bg-[#211b16] px-4 text-[#efe8dc]`}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            {filtersOpen ? "Hide filters" : "Filters"}
            {filterCount > 0 && (
              <span
                className={`${type.meta} rounded-full bg-[#cbb79c] px-2 text-[#15120f]`}
              >
                {filterCount}
              </span>
            )}
          </button>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-10">
          <aside
            id="shop-filters"
            aria-labelledby="filters-title"
            className={`${filterScrollbar} ${filtersOpen ? "block" : "hidden"} self-start rounded-md border border-white/10 bg-[#211b16] p-5 lg:sticky lg:top-[105px] lg:block lg:max-h-[calc(100vh-129px)] lg:overflow-y-auto lg:supports-[height:100svh]:max-h-[calc(100svh-129px)]`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <h2 id="filters-title" className={`${type.itemTitle} m-0`}>
                Filters
              </h2>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${type.meta} ${focus} min-h-11 text-[#cbb79c] underline underline-offset-4`}
                >
                  Clear all
                </button>
              )}
            </div>

            <FilterGroup title="Format">
              {formatOptions.map((option) => (
                <label
                  key={option.value}
                  className={`${type.small} flex min-h-11 cursor-pointer items-center gap-3 text-[#c0b4a3]`}
                >
                  <input
                    type="checkbox"
                    checked={formats.includes(option.value)}
                    onChange={(event) =>
                      toggleOption("format", option.value, event.target.checked)
                    }
                    className="h-4 w-4 shrink-0 accent-[#cbb79c]"
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {option.label}
                  </span>
                  <span className={type.meta}>{option.count}</span>
                </label>
              ))}
              {!formatOptions.length && (
                <p className={`${type.small} m-0 text-[#c0b4a3]`}>
                  {loading ? "Loading formats…" : "No formats available."}
                </p>
              )}
            </FilterGroup>

            <FilterGroup title="Availability">
              <label
                className={`${type.small} flex min-h-11 cursor-pointer items-center gap-3 text-[#c0b4a3]`}
              >
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(event) =>
                    updateParams({ stock: event.target.checked ? "in" : "all" })
                  }
                  className="h-4 w-4 shrink-0 accent-[#cbb79c]"
                />
                In stock only
              </label>
            </FilterGroup>

            <FilterGroup title="Genre">
              <div className={`${filterScrollbar} max-h-60 overflow-y-auto pr-1`}>
                {genreOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`${type.small} flex min-h-11 cursor-pointer items-center gap-3 text-[#c0b4a3]`}
                  >
                    <input
                      type="checkbox"
                      checked={genres.includes(option.value)}
                      onChange={(event) =>
                        toggleOption("genre", option.value, event.target.checked)
                      }
                      className="h-4 w-4 shrink-0 accent-[#cbb79c]"
                    />
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {option.label}
                    </span>
                    <span className={`${type.meta} text-[#c0b4a3]`}>{option.count}</span>
                  </label>
                ))}
                {!genreOptions.length && (
                  <p className={`${type.small} m-0 text-[#c0b4a3]`}>
                    {loading ? "Loading genres…" : "No genres available."}
                  </p>
                )}
              </div>
            </FilterGroup>
          </aside>

          <section
            id="shop-results"
            aria-labelledby="results-title"
            aria-busy={loading}
            className="min-w-0 scroll-mt-[105px]"
          >
            <h2 id="results-title" className="sr-only">
              Records
            </h2>
            <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  role="status"
                  aria-live="polite"
                  className={`${type.small} m-0 text-[#c0b4a3]`}
                >
                  {loading ? (
                    "Getting the crates ready…"
                  ) : error ? (
                    "Records unavailable"
                  ) : filtered.length ? (
                    <>
                      Showing{" "}
                      <span className="text-[#efe8dc]">
                        {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}
                      </span>{" "}
                      of <span className="text-[#efe8dc]">{filtered.length}</span> records
                    </>
                  ) : (
                    "0 records found"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label
                  htmlFor="shop-sort"
                  className={`${type.small} shrink-0 text-[#c0b4a3]`}
                >
                  Sort by
                </label>
                <div className="relative min-w-0 flex-1 sm:flex-none">
                  <select
                    id="shop-sort"
                    value={sort}
                    onChange={(event) => updateParams({ sort: event.target.value })}
                    className={`${type.ui} min-h-11 w-full appearance-none rounded-md border border-white/15 bg-[#211b16] py-2 pl-3 pr-9 text-[#efe8dc] focus:border-[#cbb79c] focus:outline-none focus:ring-2 focus:ring-[#cbb79c]/20 sm:w-[185px]`}
                  >
                    <option value="default">Catalogue order</option>
                    {tagSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="artist">Artist: A–Z</option>
                    <option value="title">Album: A–Z</option>
                  </select>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#cbb79c]"
                  />
                </div>
              </div>
            </div>

            {chips.length > 0 && (
              <div
                className="mb-6 flex flex-wrap items-center gap-2"
                aria-label="Applied filters"
              >
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.remove}
                    aria-label={`Remove ${chip.label}`}
                    className={`${type.meta} ${focus} inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-[#cbb79c]/25 bg-[#211b16] px-3 py-2 text-[#efe8dc] hover:border-[#cbb79c]`}
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{chip.label}</span>
                    <X size={13} aria-hidden="true" className="shrink-0 text-[#cbb79c]" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${type.small} ${focus} min-h-11 px-2 text-[#cbb79c] underline underline-offset-4`}
                >
                  Clear all
                </button>
              </div>
            )}

            {loading ? (
              <div
                aria-hidden="true"
                className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-5 xl:gap-x-5"
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <div key={index} className="motion-safe:animate-pulse">
                    <div className="mb-4 aspect-square bg-[#28231d]" />
                    <div className="mb-3 h-3 w-2/3 bg-[#28231d]" />
                    <div className="h-4 w-4/5 bg-[#28231d]" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="rounded-md border border-white/10 bg-[#211b16] px-6 py-12 text-center"
              >
                <h3 className={`${type.itemTitle} m-0 mb-3`}>
                  The crates couldn’t load.
                </h3>
                <p className={`${type.body} m-0 text-[#c0b4a3]`}>
                  Please try again in a moment.
                </p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className={`${type.ui} ${focus} mt-6 min-h-11 rounded-md bg-[#cbb79c] px-5 py-2 text-[#15120f] hover:bg-[#dfcdb3]`}
                >
                  Try again
                </button>
              </div>
            ) : visibleProducts.length ? (
              <div className="grid grid-cols-2 items-stretch gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-5 xl:gap-x-5">
                {visibleProducts.map((product) => (
                  <RecordCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-white/10 bg-[#211b16] px-6 py-14 text-center">
                <Disc3
                  size={40}
                  strokeWidth={1}
                  aria-hidden="true"
                  className="mx-auto mb-5 text-[#cbb79c]"
                />
                <h3 className={`${type.itemTitle} m-0 mb-3`}>No records found.</h3>
                <p className={`${type.body} mx-auto my-0 max-w-[340px] text-[#c0b4a3]`}>
                  {hasFilters
                    ? "Try another title or loosen a filter. There’s more in the crates."
                    : "The crates are being restocked. Check back soon."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={`${type.ui} ${focus} mt-6 min-h-11 rounded-md bg-[#cbb79c] px-5 py-2 text-[#15120f] hover:bg-[#dfcdb3]`}
                  >
                    Clear search and filters
                  </button>
                )}
              </div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <nav
                aria-label="Catalogue pagination"
                className="mt-10 flex items-center justify-between gap-3 border-t border-white/10 pt-6"
              >
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className={`${type.ui} ${focus} inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-white/15 px-3 text-[#efe8dc] enabled:hover:border-[#cbb79c] disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <p className={`${type.small} m-0 text-center text-[#c0b4a3]`}>
                  Page <span className="text-[#efe8dc]">{page}</span> of {totalPages}
                </p>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Next page"
                  className={`${type.ui} ${focus} inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-white/15 px-3 text-[#efe8dc] enabled:hover:border-[#cbb79c] disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </nav>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
