import { API } from "../api";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Disc3, Minus, Plus, ShoppingBag } from "lucide-react";
import Footer from "../footer";
import background from "../assets/backgrounds/second-slide-bg.png";
import type { Product } from "../scripts/picksOfTheWeek";
import { typography as type } from "../styles/typography";
import { useCart } from "../cart/CartContext";
import { getPriceCents, getStock } from "../cart/cartStorage";
import RestockSignup from "../stock/RestockSignup";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4";
// Keep legacy global p/a font rules from changing prices or body copy to serif.
// Scoped to main content so the header and footer wordmarks keep their own fonts.
const productFonts =
  "[&_:is(p,a,button,input,label,dl)]:font-[family-name:Arial,sans-serif]! [&_:is(h1,h2,h3)]:font-[family-name:Marcellus,Georgia,serif]!";

function money(value: number) {
  return Number.isFinite(value) ? `$${value.toFixed(2)}` : "Price unavailable";
}

function genresOf(product: Product) {
  return (product.genre || "")
    .split(/[,;|]/)
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function Cover({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-square overflow-hidden bg-[#28231d]">
      {product.cover_image && !failed ? (
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
          <Disc3 size={64} strokeWidth={1} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductDetails key={id || "missing"} id={id} />;
}

function ProductDetails({ id }: { id?: string }) {
  const { addItem, quantityFor, storageMessage } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [notice, setNotice] = useState({ text: "", error: false });

  useEffect(() => {
    const controller = new AbortController();
    window.scrollTo(0, 0);

    fetch(`${API}/api/stock`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Stock unavailable");
        return response.json();
      })
      .then((data: Product[]) => {
        if (!Array.isArray(data)) throw new Error("Invalid stock data");
        if (!controller.signal.aborted) setProducts(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  function reload() {
    setLoading(true);
    setError(false);
    setQuantity("1");
    setNotice({ text: "", error: false });
    setAttempt((value) => value + 1);
  }

  const product = products.find((item) => String(item.id) === id);
  const stock = getStock(product?.stock);
  const price = Number(product?.price);
  const validPrice = getPriceCents(product?.price) !== null;
  const inCart = quantityFor(Number(product?.id));
  const remainingStock = Math.max(0, stock - inCart);
  const productGenres = product ? genresOf(product) : [];
  const related = product
    ? products
        .filter(
          (item) =>
            String(item.id) !== String(product.id) &&
            Number(item.stock) > 0 &&
            genresOf(item).some((genre) =>
              productGenres.some((selected) => selected.toLowerCase() === genre.toLowerCase()),
            ),
        )
        .slice(0, 5)
    : [];

  function changeQuantity(amount: number) {
    setQuantity(String(Math.max(1, Math.min(remainingStock, (Number(quantity) || 1) + amount))));
    setNotice({ text: "", error: false });
  }

  function addToCart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product || stock < 1 || !validPrice) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > stock) {
      setNotice({ text: `Choose a quantity between 1 and ${stock}.`, error: true });
      return;
    }

    const result = addItem(product, amount);
    setNotice({ text: result.message, error: !result.ok });
    if (result.ok) setQuantity("1");
  }

  return (
    <div className={`${type.body} relative isolate min-h-screen bg-[#15120f] text-[#efe8dc]`}>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${background})` }}
      />

      <main
        id="main-content"
        className={`${productFonts} mx-auto max-w-[1600px] px-3 pb-8 pt-4 sm:px-4 sm:pt-5 lg:px-10 lg:pb-20 lg:pt-10`}
      >
        <nav
          aria-label="Breadcrumb"
          className={`${type.small} mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[#c0b4a3] max-lg:text-xs max-lg:leading-[18px] lg:mb-8 lg:gap-x-3 lg:gap-y-2`}
        >
          <Link to="/" className={`${focus} hover:text-[#efe8dc]`}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link to="/shop" className={`${focus} hover:text-[#efe8dc]`}>
            Shop
          </Link>
          {product && !loading && !error && (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="min-w-0 text-[#efe8dc] [overflow-wrap:anywhere]">
                {product.title}
              </span>
            </>
          )}
        </nav>

        {loading ? (
          <div role="status" className="py-20 text-center text-[#c0b4a3]">
            Getting your record ready…
          </div>
        ) : error || !product ? (
          <section className="rounded-md border border-white/10 bg-[#211b16] px-6 py-16 text-center">
            <Disc3
              size={44}
              strokeWidth={1}
              aria-hidden="true"
              className="mx-auto mb-5 text-[#cbb79c]"
            />
            <h1 className={`${type.sectionTitle} m-0 mb-4`}>
              {error ? "The record couldn’t load." : "This record isn’t in the crates."}
            </h1>
            <p role={error ? "alert" : "status"} className={`${type.body} m-0 text-[#c0b4a3]`}>
              {error
                ? "Please try again in a moment."
                : "It may have moved or is no longer listed."}
            </p>
            {error && (
              <button
                type="button"
                onClick={reload}
                className={`${type.ui} ${focus} mt-6 min-h-11 rounded-md bg-[#cbb79c] px-5 py-2 text-[#15120f] hover:bg-[#dfcdb3]`}
              >
                Try again
              </button>
            )}
            <Link
              to="/shop"
              className={`${type.ui} ${focus} mx-auto mt-6 flex min-h-11 w-fit items-center gap-2 text-[#cbb79c]`}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to the shop
            </Link>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] items-start gap-3 sm:gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-10 xl:gap-16">
              {/* COVER */}
              <div className="col-start-1 row-start-1 min-w-0 lg:sticky lg:top-[105px]">
                <div className="rounded-md border border-white/10 bg-[#211b16]/70 p-1.5 sm:p-3 lg:p-6">
                  <Cover key={product.id} product={product} />
                </div>
              </div>

              {/* PRODUCT DETAILS */}
              <div className="contents lg:block lg:min-w-0 lg:rounded-md lg:border lg:border-white/10 lg:bg-[#211b16]/95 lg:p-8 xl:p-10">
                <div className="col-start-2 row-start-1 min-w-0">
                  <p
                    className={`${type.eyebrow} m-0 mb-2 text-[#cbb79c] max-lg:text-[10px] max-lg:leading-[14px] max-lg:tracking-[0.12em] lg:mb-4`}
                  >
                    {product.medium || "From the crates"}
                  </p>
                  <Link
                    to={`/shop?q=${encodeURIComponent(product.artist)}`}
                    className={`${type.body} ${focus} mb-1.5 inline-block text-[#c0b4a3] underline decoration-[#cbb79c]/40 underline-offset-4 hover:text-[#efe8dc] max-lg:text-sm max-lg:leading-5 lg:mb-3`}
                  >
                    {product.artist}
                  </Link>
                  <h1
                    className={`${type.sectionTitle} m-0 mb-2 [overflow-wrap:anywhere] max-lg:text-[22px] max-lg:leading-[1.2] max-lg:tracking-normal lg:mb-5`}
                  >
                    {product.title}
                  </h1>

                  {product.variant && (
                    <p
                      className={`${type.small} m-0 mb-3 line-clamp-2 text-[#c0b4a3] max-lg:text-xs max-lg:leading-[18px] lg:mb-6 lg:line-clamp-none`}
                    >
                      {product.variant}
                    </p>
                  )}

                  <div className="flex flex-col items-start gap-1 border-white/10 pt-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4 lg:border-y lg:py-5">
                    <p className="m-0 font-[family-name:Arial,sans-serif] text-lg font-semibold leading-6 tracking-normal text-[#efe8dc] tabular-nums lg:text-2xl lg:leading-tight">
                      {validPrice ? money(price) : "Price unavailable"}
                    </p>
                    <p
                      className={`${type.small} m-0 inline-flex items-center gap-1.5 text-[#cbb79c] max-lg:text-xs max-lg:leading-[18px] lg:gap-2`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${stock > 0 ? "bg-[#cbb79c]" : "bg-[#c0b4a3]"}`}
                      />
                      {stock > 0 ? `In stock · ${stock} available` : "Sold out"}
                    </p>
                  </div>
                </div>

                {/* QUANTITY + CART */}
                <div className="col-span-2 row-start-2 min-w-0 rounded-md border border-white/10 bg-[#211b16]/95 p-3 sm:p-4 lg:mt-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
                  <form onSubmit={addToCart}>
                    <div className="mb-2 flex items-center justify-between gap-3 lg:mb-3">
                      <label htmlFor="record-quantity" className={type.ui}>
                        Quantity
                      </label>
                      {inCart > 0 && (
                        <Link
                          to="/cart"
                          className={`${type.meta} ${focus} inline-flex min-h-6 items-center gap-1 text-[#cbb79c] underline underline-offset-4`}
                        >
                          {inCart} in cart <ArrowUpRight size={12} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                    <div className="flex min-w-0 items-start gap-2 lg:gap-3">
                      <div className="flex h-11 shrink-0 items-center rounded-md border border-white/15 bg-[#15120f] lg:h-[52px]">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => changeQuantity(-1)}
                          disabled={remainingStock < 1 || Number(quantity) <= 1}
                          className={`${focus} flex h-10 w-9 items-center justify-center rounded-md text-[#cbb79c] cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 lg:h-12 lg:w-11`}
                        >
                          <Minus size={16} aria-hidden="true" />
                        </button>
                        <input
                          id="record-quantity"
                          name="quantity"
                          type="number"
                          min="1"
                          max={Math.max(1, remainingStock)}
                          step="1"
                          required
                          disabled={remainingStock < 1}
                          value={quantity}
                          onChange={(event) => {
                            setQuantity(event.target.value);
                            setNotice({ text: "", error: false });
                          }}
                          className={`${type.body} h-10 w-9 appearance-none border-0 bg-transparent! p-0 text-center text-[#efe8dc]! focus:outline-none focus:ring-1 focus:ring-[#cbb79c] lg:h-11 lg:w-12 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]`}
                        />
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => changeQuantity(1)}
                          disabled={remainingStock < 1 || Number(quantity) >= remainingStock}
                          className={`${focus} flex h-10 w-9 items-center justify-center rounded-md text-[#cbb79c] cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 lg:h-12 lg:w-11`}
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={remainingStock < 1 || !validPrice}
                        className={`${type.ui} ${focus} inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-[#cbb79c] px-3 py-2 text-[#15120f] enabled:hover:bg-[#dfcdb3] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-[52px] lg:gap-3 lg:px-5 lg:py-3`}
                      >
                        <ShoppingBag size={18} aria-hidden="true" />
                        {stock < 1
                          ? "Sold out"
                          : remainingStock < 1
                            ? "In your cart"
                            : "Add to cart"}
                      </button>
                    </div>
                    <p
                      role={notice.error ? "alert" : "status"}
                      className={`${type.small} mb-0 mt-2 ${notice.text ? "min-h-6" : "hidden lg:block lg:min-h-6"} max-lg:text-xs lg:mt-3 ${notice.error ? "text-[#efe8dc]" : "text-[#cbb79c]"}`}
                    >
                      {notice.text}
                    </p>
                    {storageMessage && (
                      <p role="status" className={`${type.meta} mb-0 mt-2 text-[#cbb79c]`}>
                        {storageMessage}
                      </p>
                    )}
                  </form>

                  {stock < 1 && (
                    <RestockSignup
                      key={product.id}
                      productId={Number(product.id)}
                      onAvailable={reload}
                    />
                  )}

                  {stock < 1 && (
                    <Link
                      to="/request"
                      className={`${type.small} ${focus} mt-2 inline-flex min-h-11 items-center gap-2 text-[#cbb79c] underline underline-offset-4 max-lg:text-xs lg:mb-5 lg:mt-0`}
                    >
                      Request this record
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                </div>

                {/* DESCRIPTION */}
                <div className="col-span-2 row-start-3 min-w-0 rounded-md border border-white/10 bg-[#211b16]/95 p-4 sm:p-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
                  {product.description && (
                    <section className="border-white/10 lg:mt-6 lg:border-t lg:pt-6">
                      <h2
                        className={`${type.itemTitle} m-0 mb-3 max-lg:text-base! max-lg:leading-6`}
                      >
                        About this record
                      </h2>
                      <p
                        className={`${type.body} m-0 whitespace-pre-line text-[#c0b4a3] [overflow-wrap:anywhere] max-lg:text-sm max-lg:leading-[22px]`}
                      >
                        {product.description}
                      </p>
                    </section>
                  )}

                  <section className="mt-5 border-t border-white/10 pt-5 lg:mt-7 lg:pt-6">
                    <h2 className={`${type.itemTitle} m-0 mb-4 max-lg:text-base! max-lg:leading-6`}>
                      The details
                    </h2>
                    <dl className={`${type.small} m-0`}>
                      {[
                        ["Format", product.medium],
                        ["Pressing", product.variant],
                        ["Released", product.released],
                        ["Barcode", product.barcode],
                      ]
                        .filter(([, value]) => Boolean(value))
                        .map(([label, value]) => (
                          <div
                            key={label}
                            className="grid grid-cols-[85px_minmax(0,1fr)] gap-4 border-b border-white/10 py-3"
                          >
                            <dt className="text-[#c0b4a3] max-lg:text-xs">{label}</dt>
                            <dd className="m-0 text-[#efe8dc] [overflow-wrap:anywhere]">{value}</dd>
                          </div>
                        ))}
                      {productGenres.length > 0 && (
                        <div className="grid grid-cols-[85px_minmax(0,1fr)] gap-4 py-3">
                          <dt className="text-[#c0b4a3] max-lg:text-xs">Genre</dt>
                          <dd className="m-0 flex flex-wrap gap-x-3 gap-y-2">
                            {productGenres.map((genre) => (
                              <Link
                                key={genre}
                                to={`/shop?genre=${encodeURIComponent(genre)}`}
                                className={`${focus} text-[#cbb79c] underline decoration-[#cbb79c]/40 underline-offset-4`}
                              >
                                {genre}
                              </Link>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </section>
                </div>
              </div>
            </div>

            {/* RELATED RECORDS */}
            {related.length > 0 && (
              <section
                aria-labelledby="related-title"
                className="mt-14 border-t border-white/10 pt-10 lg:mt-20 lg:pt-14"
              >
                <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className={`${type.eyebrow} m-0 mb-3 text-[#cbb79c]`}>
                      Keep the turntable going
                    </p>
                    <h2
                      id="related-title"
                      className={`${type.sectionTitle} m-0 max-lg:text-xl max-lg:leading-[1.2]`}
                    >
                      More for your rotation.
                    </h2>
                  </div>
                  <Link
                    to="/shop"
                    className={`${type.ui} ${focus} inline-flex min-h-11 items-center gap-2 text-[#cbb79c]`}
                  >
                    Explore the crates
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6">
                  {related.map((item) => (
                    <article key={item.id} className="min-w-0">
                      <Link to={`/shop/product/${item.id}`} className={`${focus} block rounded-sm`}>
                        <Cover product={item} />
                        <p
                          className={`${type.small} mb-1 mt-4 text-[#c0b4a3] [overflow-wrap:anywhere]`}
                        >
                          {item.artist}
                        </p>
                        <h3
                          className={`${type.itemTitle} m-0 mb-2 text-[#efe8dc] [overflow-wrap:anywhere] max-lg:text-base! max-lg:leading-5`}
                        >
                          {item.title}
                        </h3>
                        <p
                          className={`${type.meta} m-0 mb-3 text-[#c0b4a3] [overflow-wrap:anywhere]`}
                        >
                          {[item.medium, item.variant].filter(Boolean).join(" · ")}
                        </p>
                        <p className={`${type.ui} m-0 text-[#cbb79c]`}>
                          {money(Number(item.price))}
                        </p>
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
