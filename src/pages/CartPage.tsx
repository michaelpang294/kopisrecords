import { API } from "../api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Disc3,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Footer from "../footer";
import background from "../assets/backgrounds/second-slide-bg.png";
import type { Product } from "../scripts/product";
import { typography as type } from "../styles/typography";
import { useCart } from "../cart/CartContext";
import { formatPrice, getPriceCents, getStock } from "../cart/cartStorage";
import type { CartItem } from "../cart/cartStorage";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4";
const cartFonts =
  "[&_:is(p,a,button,input,label,dl)]:font-[family-name:Arial,sans-serif]! [&_:is(h1,h2,h3)]:font-[family-name:Marcellus,Georgia,serif]!";

type CartLine = {
  item: CartItem;
  product: Product | undefined;
  stock: number;
  unitPrice: number | null;
  linePrice: number | null;
  problem: string;
};

function resolveLine(item: CartItem, product: Product | undefined): CartLine {
  const stock = getStock(product?.stock);
  const unitPrice = getPriceCents(product?.price);
  const total = unitPrice === null ? null : unitPrice * item.quantity;
  const linePrice =
    total !== null && Number.isSafeInteger(total) ? total : null;
  let problem = "";
  if (!product)
    problem =
      "This record is no longer listed. Please remove it from your cart.";
  else if (stock < 1)
    problem =
      "This record is currently sold out. Please remove it from your cart.";
  else if (item.quantity > stock)
    problem = `Only ${stock} available. Please reduce the quantity.`;
  else if (linePrice === null)
    problem = "A current price isn’t available for this record.";
  return { item, product, stock, unitPrice, linePrice, problem };
}

function CartCover({ product }: { product: Product | undefined }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-square overflow-hidden rounded-sm bg-[#28231d]">
      {product?.cover_image && !failed ? (
        <img
          src={product.cover_image}
          alt={`${product.artist} — ${product.title} cover`}
          onError={() => setFailed(true)}
          className="block h-full w-full object-contain"
        />
      ) : (
        <div
          role="img"
          aria-label="Cover unavailable"
          className="grid h-full place-items-center text-[#cbb79c]"
        >
          <Disc3 size={30} strokeWidth={1} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function CartRow({ line, onRemove }: { line: CartLine; onRemove: () => void }) {
  const { updateQuantity } = useCart();
  const { item, product, stock, unitPrice, linePrice, problem } = line;
  const [edit, setEdit] = useState({
    quantity: item.quantity,
    draft: String(item.quantity),
    error: "",
  });
  const draft =
    edit.quantity === item.quantity ? edit.draft : String(item.quantity);
  const error = edit.quantity === item.quantity ? edit.error : "";
  const title = product?.title || "Unavailable record";
  const disabled = !product || stock < 1;
  const errorId = `cart-quantity-error-${item.id}`;

  function changeQuantity(value: number) {
    const result = updateQuantity(item.id, value, stock);
    setEdit({
      quantity: item.quantity,
      draft: String(result.ok ? value : item.quantity),
      error: result.ok ? "" : result.message,
    });
  }

  function commitDraft() {
    const amount = Number(draft);
    if (amount === item.quantity) {
      setEdit({
        quantity: item.quantity,
        draft: String(item.quantity),
        error: "",
      });
      return;
    }
    changeQuantity(amount);
  }

  return (
    <article
      aria-label={`${title} in cart`}
      className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-md border border-white/10 bg-[#211b16]/95 p-3 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-4 sm:p-5"
    >
      <div className="min-w-0">
        {product ? (
          <Link
            to={`/shop/product/${item.id}`}
            className={`${focus} block rounded-sm`}
          >
            <CartCover
              key={`${item.id}-${product.cover_image}`}
              product={product}
            />
          </Link>
        ) : (
          <CartCover product={undefined} />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {product && (
              <p
                className={`${type.meta} m-0 mb-1 text-[#c0b4a3] [overflow-wrap:anywhere]`}
              >
                {product.artist}
              </p>
            )}
            <h2
              className={`${type.itemTitle} m-0 mb-1 text-[#efe8dc] [overflow-wrap:anywhere] max-sm:text-base`}
            >
              {product ? (
                <Link
                  to={`/shop/product/${item.id}`}
                  className={`${focus} hover:text-[#cbb79c]`}
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </h2>
            {product && (
              <p
                className={`${type.meta} m-0 text-[#c0b4a3] [overflow-wrap:anywhere]`}
              >
                {[product.medium, product.variant].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className={`${type.small} m-0 mt-2 text-[#efe8dc] tabular-nums`}>
              {unitPrice !== null ? (
                <>
                  {formatPrice(unitPrice)}{" "}
                  <span className={`${type.meta} text-[#c0b4a3]`}>each</span>
                </>
              ) : (
                "Price unavailable"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title} from cart`}
            className={`${focus} flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#c0b4a3] hover:bg-white/5 hover:text-[#efe8dc]`}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 sm:col-span-1 sm:col-start-2">
        <div className="flex h-11 items-center rounded-md border border-white/15 bg-[#15120f]">
          <button
            type="button"
            aria-label={`Decrease quantity of ${title}`}
            onClick={() => changeQuantity(Math.min(item.quantity - 1, stock))}
            disabled={disabled || item.quantity <= 1}
            className={`${focus} flex h-10 w-9 cursor-pointer items-center justify-center rounded-md text-[#cbb79c] disabled:cursor-not-allowed disabled:opacity-35`}
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <label htmlFor={`cart-quantity-${item.id}`} className="sr-only">
            Quantity of {title}
          </label>
          <input
            id={`cart-quantity-${item.id}`}
            type="number"
            min="1"
            max={Math.max(1, stock)}
            step="1"
            inputMode="numeric"
            disabled={disabled}
            value={draft}
            onChange={(event) =>
              setEdit({
                quantity: item.quantity,
                draft: event.target.value,
                error: "",
              })
            }
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
              }
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="h-10 w-10 appearance-none border-0 bg-transparent! p-0 text-center font-[family-name:Arial,sans-serif] text-base text-[#efe8dc]! focus:outline-none focus:ring-1 focus:ring-[#cbb79c] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label={`Increase quantity of ${title}`}
            onClick={() => changeQuantity(item.quantity + 1)}
            disabled={disabled || item.quantity >= stock}
            className={`${focus} flex h-10 w-9 cursor-pointer items-center justify-center rounded-md text-[#cbb79c] disabled:cursor-not-allowed disabled:opacity-35`}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
        <p className="m-0 font-[family-name:Arial,sans-serif] text-base font-semibold text-[#efe8dc] tabular-nums sm:text-lg">
          {linePrice !== null ? formatPrice(linePrice) : "—"}
        </p>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className={`${type.meta} col-span-2 m-0 text-[#efe8dc]`}
        >
          {error}
        </p>
      )}
      {problem && (
        <div
          className={`${type.meta} col-span-2 flex items-start gap-2 rounded-md border border-[#cbb79c]/25 bg-[#15120f]/60 p-3 text-[#cbb79c]`}
        >
          <TriangleAlert
            size={15}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <div>
            <p className="m-0">{problem}</p>
            {product && stock > 0 && item.quantity > stock && (
              <button
                type="button"
                onClick={() => changeQuantity(stock)}
                className={`${focus} mt-1 min-h-9 cursor-pointer underline underline-offset-4`}
              >
                Set quantity to {stock}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function CartPage() {
  const { items, itemCount, storageMessage, removeItem, clearCart } = useCart();
  const [attempt, setAttempt] = useState(0);
  const [catalogueResult, setCatalogueResult] = useState<{
    attempt: number;
    products: Product[];
    status: "ready" | "error";
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const hasItems = items.length > 0;
  const status = !hasItems
    ? "idle"
    : catalogueResult?.attempt === attempt
      ? catalogueResult.status
      : "loading";
  const products = catalogueResult?.products || [];

  useEffect(() => {
    if (!hasItems) return;
    const controller = new AbortController();
    fetch(`${API}/api/stock`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Stock unavailable");
        return response.json();
      })
      .then((data: Product[]) => {
        if (!Array.isArray(data)) throw new Error("Invalid stock data");
        if (!controller.signal.aborted) {
          setCatalogueResult({ attempt, products: data, status: "ready" });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCatalogueResult({ attempt, products: [], status: "error" });
      });
    return () => controller.abort();
  }, [hasItems, attempt]);

  useEffect(() => {
    if (!hasItems) return;
    function refresh() {
      setAttempt((value) => value + 1);
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [hasItems]);

  const catalogue = new Map(
    products.map((product) => [Number(product.id), product]),
  );
  const lines = items.map((item) => resolveLine(item, catalogue.get(item.id)));
  const subtotalValue = lines.reduce(
    (sum, line) => sum + (line.linePrice ?? 0),
    0,
  );
  const subtotal =
    status === "ready" &&
    lines.every((line) => line.linePrice !== null) &&
    Number.isSafeInteger(subtotalValue)
      ? subtotalValue
      : null;
  const problems =
    status === "ready" ? lines.filter((line) => line.problem).length : 0;

  return (
    <div
      className={`${type.body} relative isolate min-h-screen bg-[#15120f] text-[#efe8dc]`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${background})` }}
      />
      <main
        id="main-content"
        className={`${cartFonts} mx-auto max-w-[1320px] px-3 pb-12 pt-4 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10`}
      >
        <nav
          aria-label="Breadcrumb"
          className={`${type.meta} mb-5 flex items-center gap-2 text-[#c0b4a3] lg:mb-8`}
        >
          <Link to="/" className={`${focus} hover:text-[#efe8dc]`}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#efe8dc]">
            Cart
          </span>
        </nav>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
          <div>
            <p className={`${type.eyebrow} m-0 mb-2 text-[#cbb79c]`}>
              From our crates to yours
            </p>
            <h1 className={`${type.sectionTitle} m-0 max-lg:text-[28px]`}>
              Your cart
            </h1>
            <p className={`${type.small} m-0 mt-2 text-[#c0b4a3]`}>
              {itemCount} {itemCount === 1 ? "item" : "items"}
              {hasItems &&
                ` · ${items.length} ${items.length === 1 ? "title" : "titles"}`}
            </p>
          </div>
          {hasItems && (
            <Link
              to="/shop"
              className={`${type.small} ${focus} inline-flex min-h-11 items-center gap-2 text-[#cbb79c]`}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Keep digging
            </Link>
          )}
        </header>

        <p role="status" className="sr-only">
          {announcement}
        </p>
        {storageMessage && (
          <p
            role="status"
            className={`${type.small} mb-5 rounded-md border border-[#cbb79c]/25 bg-[#211b16] p-4 text-[#cbb79c]`}
          >
            {storageMessage}
          </p>
        )}

        {!hasItems ? (
          <section className="rounded-md border border-white/10 bg-[#211b16]/95 px-6 py-14 text-center sm:py-20">
            <ShoppingBag
              size={42}
              strokeWidth={1}
              aria-hidden="true"
              className="mx-auto mb-5 text-[#cbb79c]"
            />
            <h2 className={`${type.itemTitle} m-0 mb-3`}>
              A little empty no?
            </h2>
            <p
              className={`${type.small} mx-auto my-0 max-w-[340px] text-[#c0b4a3]`}
            >
              Your cart is empty. Have a dig through our crates :)
            </p>
            <Link
              to="/shop"
              className={`${type.ui} ${focus} mt-6 inline-flex min-h-11 items-center gap-5 rounded-md bg-[#cbb79c] px-5 py-3 text-[#15120f] hover:bg-[#dfcdb3]`}
            >
              Shop all
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        ) : status === "error" ? (
          <section
            role="alert"
            className="rounded-md border border-white/10 bg-[#211b16] p-6 text-center sm:p-10"
          >
            <h2 className={`${type.itemTitle} m-0 mb-3`}>
              We couldn’t check the crates.
            </h2>
            <p className={`${type.small} m-0 text-[#c0b4a3]`}>
              Your selected items are still in your cart. Try again to load
              current prices and availability.
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className={`${type.ui} ${focus} mt-6 min-h-11 cursor-pointer rounded-md bg-[#cbb79c] px-5 py-2 text-[#15120f] hover:bg-[#dfcdb3]`}
            >
              Try again
            </button>
          </section>
        ) : status !== "ready" ? (
          <div role="status">
            <p className={`${type.small} m-0 mb-4 text-[#c0b4a3]`}>
              Checking prices and availability…
            </p>
            <div aria-hidden="true" className="space-y-3">
              {Array.from({ length: Math.min(items.length, 3) }, (_, index) => (
                <div
                  key={index}
                  className="flex gap-4 rounded-md border border-white/10 bg-[#211b16] p-4 motion-safe:animate-pulse"
                >
                  <div className="h-16 w-16 shrink-0 bg-[#28231d]" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-3 w-1/3 bg-[#28231d]" />
                    <div className="h-4 w-2/3 bg-[#28231d]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
            <section aria-label="Records in your cart" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className={`${type.small} m-0 text-[#c0b4a3] lg:hidden`}>
                  Subtotal:{" "}
                  <strong className="font-medium text-[#efe8dc]">
                    {subtotal !== null ? formatPrice(subtotal) : "—"}
                  </strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearCart();
                    setAnnouncement("Cart cleared.");
                  }}
                  className={`${type.meta} ${focus} min-h-11 cursor-pointer text-[#c0b4a3] underline underline-offset-4 hover:text-[#efe8dc]`}
                >
                  Clear cart
                </button>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {lines.map((line) => (
                  <CartRow
                    key={line.item.id}
                    line={line}
                    onRemove={() => {
                      removeItem(line.item.id);
                      setAnnouncement(
                        `${line.product?.title || "Record"} removed from cart.`,
                      );
                    }}
                  />
                ))}
              </div>
            </section>

            <aside
              aria-labelledby="cart-summary-title"
              className="rounded-md border border-white/10 bg-[#211b16]/95 p-5 sm:p-6 lg:sticky lg:top-[105px]"
            >
              <h2
                id="cart-summary-title"
                className={`${type.itemTitle} m-0 mb-5`}
              >
                Cart summary
              </h2>
              <div
                className={`${type.small} mb-4 flex justify-between gap-4 text-[#c0b4a3]`}
              >
                <span>
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
                <span>SGD</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-y border-white/10 py-5">
                <p className={`${type.ui} m-0`}>Subtotal</p>
                <p
                  aria-live="polite"
                  className="m-0 font-[family-name:Arial,sans-serif] text-2xl font-semibold text-[#efe8dc] tabular-nums"
                >
                  {subtotal !== null ? formatPrice(subtotal) : "—"}
                </p>
              </div>
              {problems > 0 && (
                <p
                  role="status"
                  className={`${type.small} mb-0 mt-4 text-[#cbb79c]`}
                >
                  {problems} {problems === 1 ? "record needs" : "records need"}{" "}
                  attention. Review the highlighted items in your cart.
                </p>
              )}
              {subtotal === null && (
                <p className={`${type.meta} mb-0 mt-3 text-[#c0b4a3]`}>
                  Remove records without a current price to calculate your
                  subtotal.
                </p>
              )}
              <p className={`${type.meta} mb-0 mt-4 text-[#c0b4a3]`}>
                Delivery is not included in this subtotal. Adding records to
                your cart does not reserve stock.
              </p>
              <Link
                to="/checkout"
                className={`${type.ui} ${focus} mt-6 flex min-h-11 items-center justify-center gap-3 rounded-md bg-[#cbb79c] px-4 py-3 text-[#15120f] hover:bg-[#dfcdb3]`}
              >
                Checkout
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className={`${type.meta} ${focus} mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 text-[#c0b4a3] hover:text-[#efe8dc]`}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Refresh prices & stock
              </button>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
