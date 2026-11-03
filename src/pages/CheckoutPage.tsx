import { API } from "../admin/adminApi";
import OrderLink from "../orders/OrderLink";
import {
  newCheckoutId,
  prepareRecovery,
  activeCheckout,
  setActiveCheckout,
  clearActiveCheckout,
  tokenForOrder,
} from "../orders/orderRecovery";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cart/CartContext";
import { formatPrice } from "../cart/cartStorage";
import Footer from "../footer";
import background from "../assets/backgrounds/second-slide-bg.png";
type Order = {
  reference: string;
  subtotal: number;
  delivery: number;
  total: number;
  qr: string | null;
  status: string;
  expiresAt?: string;
  serverTime: string;
  recoveryToken?: string;
  items: { id: number; title: string; quantity: number; price: number }[];
};
const panel = "rounded-lg border border-white/10 bg-[#211b16]/95 p-5 sm:p-7";
const input =
  "mt-2 mb-5 block min-h-11 w-full rounded-md border border-white/15 bg-[#15120f] p-3 text-sm text-[#efe8dc] outline-none focus:border-[#cbb79c]";
export default function CheckoutPage() {
  const { items, completeOrder, storageMessage } = useCart();
  const completeOrderRef = useRef(completeOrder);
  useEffect(() => {
    completeOrderRef.current = completeOrder;
  }, [completeOrder]);
  const finishedId = useRef("");
  const accessReady = useRef(new Set<string>());
  const [method, setMethod] = useState("collection");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef({ signature: "", id: "" });
  const [orderId, setOrderId] = useState(() => activeCheckout()?.id || "");
  const [restoring, setRestoring] = useState(Boolean(orderId));
  const [recoveryToken, setRecoveryToken] = useState(() =>
    tokenForOrder(orderId),
  );
  const [now, setNow] = useState(() => Date.now());
  const offset = useRef(0);
  const acceptOrder = useCallback((value: Order, id: string) => {
    const completed = [
      "payment_reported",
      "paid",
      "ready_for_collection",
      "dispatched",
      "completed",
    ].includes(value.status);
    // Ignore an older polling response after reporting payment succeeds.
    if (finishedId.current === id && !completed) return;
    const token = value.recoveryToken || tokenForOrder(id);
    if (token) {
      setRecoveryToken(token);
      setActiveCheckout(id, token);
    }

    if (completed) {
      finishedId.current = id;
      completeOrderRef.current(id, value.items);
      try {
        clearActiveCheckout();
      } catch {
        /* Storage may be unavailable. */
      }
      setOrderId("");
      request.current = { signature: "", id: "" };
    }
    offset.current = Date.parse(value.serverTime) - Date.now();
    setOrder(value);
    setNow(Date.now() + offset.current);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    async function refresh() {
      try {
        let token = tokenForOrder(orderId);
        if (!accessReady.current.has(orderId)) {
          if (!token) token = prepareRecovery(orderId);
          const access = await fetch(
            `${API}/api/checkout/${orderId}/recovery`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recoveryToken: token }),
            },
          );
          const grant = await access.json();
          if (!access.ok)
            throw Error(grant.error || "Unable to create your order link.");
          accessReady.current.add(orderId);
        }
        const response = await fetch(`${API}/api/checkout/${orderId}`, {
          cache: "no-store",
        });
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error || "Unable to restore your order.");
        if (active) {
          acceptOrder({ ...value, recoveryToken: token }, orderId);
          setError("");
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to check your hold. Please retry before paying.",
          );
      } finally {
        if (active) setRestoring(false);
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [orderId, acceptOrder]);
  const seconds = order?.expiresAt
    ? Math.max(0, Math.ceil((Date.parse(order.expiresAt) - now) / 1000))
    : 0;
  const activeHold =
    order?.status === "awaiting_payment_confirmation" && seconds > 0;
  async function reportPayment() {
    if (busy || !activeHold) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/api/checkout/${orderId}/payment-reported`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error || "Unable to report payment.");
      acceptOrder(value, orderId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to report payment. Contact us with your reference.",
      );
    } finally {
      setBusy(false);
    }
  }
  function startAgain() {
    finishedId.current = "";
    setOrder(null);
    setRecoveryToken("");
    setOrderId("");
    request.current = { signature: "", id: "" };
    setError("");
    try {
      clearActiveCheckout();
    } catch {
      /* Storage may be unavailable. */
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const body = {
      items,
      fulfilment: method,
      name: String(data.get("name") || ""),
      contact: String(data.get("contact") || ""),
      address: String(data.get("address") || ""),
      postal: String(data.get("postal") || ""),
    };
    const signature = JSON.stringify(body);
    if (signature !== request.current.signature)
      request.current = { signature, id: newCheckoutId() };
    const token = prepareRecovery(request.current.id);
    try {
      setActiveCheckout(request.current.id, token);
    } catch {
      /* Continue without refresh recovery if storage is blocked. */
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          requestId: request.current.id,
          recoveryToken: token,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          clearActiveCheckout(request.current.id);
          try {
            clearActiveCheckout();
          } catch {
            /* Storage unavailable. */
          }
        }
        throw new Error(result.error || "Checkout unavailable.");
      }
      const id = request.current.id;
      accessReady.current.add(id);
      acceptOrder(
        { ...result, recoveryToken: result.recoveryToken || token },
        id,
      );
      if (result.status === "payment_reported" || result.status === "paid")
        return;
      setOrderId(id);
      try {
        setActiveCheckout(request.current.id, token);
      } catch {
        /* Keep this tab open if storage is blocked. */
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <main
        className="min-h-screen bg-[#15120f] bg-cover bg-center px-4 py-6 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6 sm:py-10"
        style={{
          backgroundImage: `linear-gradient(#15120fd9,#15120feb),url(${background})`,
        }}
      >
        <div className="mx-auto max-w-[1100px]">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-[#c0b4a3]">
            <Link to="/cart" className="underline">
              Cart
            </Link>{" "}
            / Checkout{" "}
          </nav>
          <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
            Nearly on your turntable
          </p>
          <h1 className="mb-7 font-marcellus text-3xl font-normal sm:text-5xl">
            {order?.status === "payment_reported" || order?.status === "paid"
              ? "Order submitted"
              : order
                ? "Your PayNow payment"
                : "Checkout"}
          </h1>
          {restoring ? (
            <p role="status">Restoring your checkout…</p>
          ) : order &&
            (order.status === "payment_reported" || order.status === "paid") ? (
            <section
              className={`${panel} mx-auto max-w-[720px]`}
              aria-labelledby="completion-title"
            >
              <p className="mb-3 text-xs uppercase tracking-[.15em] text-[#cbb79c]">
                {order.status === "paid"
                  ? "Payment confirmed"
                  : "Awaiting payment verification"}
              </p>
              <h2
                id="completion-title"
                className="font-marcellus text-2xl sm:text-3xl"
              >
                Thank you. We’ll be in touch.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#c0b4a3]">
                {order.status === "paid"
                  ? "Your payment has been confirmed."
                  : "We’ve received your payment update and will check receipt."}{" "}
                We’ll contact you using the phone number or Telegram you
                provided to arrange collection or delivery. You don’t need to
                pay again.
              </p>
              <p className="mt-6 break-all text-sm">
                Order reference: <strong>{order.reference}</strong>
              </p>
              <ul className="mt-4 divide-y divide-white/10">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      {item.quantity} × {item.title}
                    </span>
                    <span>{formatPrice(item.quantity * item.price)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex justify-between border-t border-white/10 pt-4 text-lg">
                <span>Total</span>
                <strong>{formatPrice(order.total)}</strong>
              </p>
              <p className="mt-4 text-xs text-[#c0b4a3]">
                Keep a screenshot of this reference for your records.
              </p>
              {storageMessage && (
                <p role="status" className="mt-4 text-xs text-[#c0b4a3]">
                  {storageMessage}
                </p>
              )}
              <OrderLink token={recoveryToken} />
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/shop"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#cbb79c] px-6 py-3 text-sm text-[#15120f] hover:bg-[#dfcdb3]"
                >
                  Continue shopping ↗
                </Link>
                <Link
                  to="/"
                  className="inline-flex min-h-11 items-center justify-center px-4 py-3 text-sm text-[#cbb79c] underline underline-offset-4"
                >
                  Back to home
                </Link>
              </div>
              <a
                href={`mailto:kopisrecords@gmail.com?subject=${encodeURIComponent(`Order ${order.reference}`)}`}
                className="mt-4 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline underline-offset-4"
              >
                Contact us about this order ↗
              </a>
            </section>
          ) : order ? (
            <div className="grid gap-5 md:grid-cols-2">
              <section className={`${panel} text-center`}>
                <h2 className="font-marcellus text-2xl">
                  {order.status === "payment_reported" ||
                  order.status === "paid"
                    ? "Thank you. We’ll be in touch."
                    : activeHold
                      ? "Your records are on hold."
                      : "Your hold has ended."}
                </h2>
                {activeHold && (
                  <p role="timer" className="mt-3 text-sm text-[#cbb79c]">
                    Time remaining: {Math.floor(seconds / 60)}:
                    {String(seconds % 60).padStart(2, "0")}
                  </p>
                )}
                {(order.status === "payment_reported" ||
                  order.status === "paid") && (
                  <p className="mt-4 text-sm leading-relaxed text-[#c0b4a3]">
                    We’ve received your payment update. We’ll verify receipt and
                    contact you using the phone number or Telegram you provided
                    to arrange collection or delivery. You don’t need to pay
                    again.
                  </p>
                )}
                {!activeHold &&
                  order.status !== "payment_reported" &&
                  order.status !== "paid" && (
                    <p role="status" className="mt-4 text-sm text-[#c0b4a3]">
                      Do not pay using this QR. If you already paid, contact us
                      with your order reference. Your bank may still accept a
                      previously saved QR.
                    </p>
                  )}
                <p className="mt-4 text-sm">
                  PayNow to <strong>91470168</strong>
                </p>
                {activeHold && !error && order.qr && (
                  <>
                    <img
                      src={order.qr}
                      alt={`PayNow QR for ${formatPrice(order.total)}`}
                      className="mx-auto my-5 w-full max-w-[280px] rounded-md"
                    />
                    <a
                      href={order.qr}
                      download={`${order.reference}-paynow.png`}
                      className="inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline"
                    >
                      Save QR to your phone ↓
                    </a>
                  </>
                )}
                <p className="mt-4 text-xs leading-relaxed text-[#c0b4a3]">
                  Scan with your banking app, or import the saved QR if
                  supported. Check the bank’s registered recipient and amount
                  before paying. The shop label in the QR is not bank
                  verification.
                </p>
              </section>
              <section className={panel}>
                <OrderLink token={recoveryToken} />
                <p className="mb-4 mt-5 text-xs text-[#cbb79c]">
                  {order.status === "payment_reported" ||
                  order.status === "paid"
                    ? order.status === "paid"
                      ? "Payment confirmed"
                      : "Payment reported · awaiting verification"
                    : activeHold
                      ? "Awaiting payment confirmation"
                      : "Hold expired / closed"}
                </p>
                <h2 className="font-marcellus text-2xl">Your order</h2>
                <p className="my-4 break-all text-sm">
                  Reference: <strong>{order.reference}</strong>
                </p>
                <ul className="divide-y divide-white/10">
                  {order.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span>
                        {i.quantity} × {i.title}
                      </span>
                      <span>{formatPrice(i.quantity * i.price)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt>Records</dt>
                    <dd>{formatPrice(order.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>
                      {order.delivery ? "Delivery · 1–2 days" : "Collection"}
                    </dt>
                    <dd>
                      {order.delivery ? formatPrice(order.delivery) : "Free"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4 text-xl">
                    <dt>Total</dt>
                    <dd>{formatPrice(order.total)}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-sm leading-relaxed text-[#c0b4a3]">
                  Keep this order reference. Your records are held for 15
                  minutes while you pay. Report payment before the timer ends to
                  keep them held for manual verification. Payment is not
                  automatically detected. Please don’t pay twice.
                </p>
                {activeHold && (
                  <button
                    type="button"
                    onClick={reportPayment}
                    disabled={busy || Boolean(error)}
                    className="mt-5 min-h-11 w-full rounded-md bg-[#cbb79c] p-3 text-sm text-[#15120f] disabled:opacity-50"
                  >
                    {busy ? "Submitting…" : "I’ve made payment"}
                  </button>
                )}
                {!activeHold &&
                  order.status !== "payment_reported" &&
                  order.status !== "paid" && (
                    <button
                      type="button"
                      onClick={startAgain}
                      className="mt-5 min-h-11 text-sm text-[#cbb79c] underline"
                    >
                      Start a fresh checkout (only if you haven’t paid)
                    </button>
                  )}
                <a
                  href={`mailto:kopisrecords@gmail.com?subject=${encodeURIComponent(`Order ${order.reference}`)}`}
                  className="mt-4 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline"
                >
                  Contact us about this order ↗
                </a>
              </section>
            </div>
          ) : orderId ? (
            <p role="status">
              Checking your existing order. Keep this page open.
            </p>
          ) : !items.length ? (
            <section className={panel}>
              Your cart is empty.{" "}
              <Link to="/shop" className="underline">
                Explore the records ↗
              </Link>
            </section>
          ) : (
            <form
              onSubmit={submit}
              className="grid items-start gap-5 md:grid-cols-[1.2fr_1fr]"
            >
              <section className={panel}>
                <h2 className="mb-5 font-marcellus text-2xl">Your details</h2>
                <label className="text-sm">
                  Name
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    maxLength={120}
                    className={input}
                  />
                </label>
                <label className="text-sm">
                  Phone number / Telegram
                  <input
                    name="contact"
                    required
                    maxLength={120}
                    placeholder="+65 9123 4567 or @username"
                    className={input}
                  />
                </label>
                <fieldset>
                  <legend className="mb-3 font-marcellus text-xl">
                    Collection or delivery?
                  </legend>
                  {[
                    {
                      id: "collection",
                      title: "Free collection",
                      detail:
                        "Rocks Cafe · 98 Arab Street, Level 2, Back Alley Entrance (199794)",
                    },
                    {
                      id: "delivery",
                      title: "Delivery · $4.50",
                      detail: "1–2 days · Singapore",
                    },
                  ].map((o) => (
                    <label
                      key={o.id}
                      className="mb-3 flex cursor-pointer items-start gap-3 rounded-md border border-white/15 p-4 text-sm"
                    >
                      <input
                        type="radio"
                        name="fulfilment"
                        checked={method === o.id}
                        onChange={() => setMethod(o.id)}
                        className="mt-1 accent-[#cbb79c]"
                      />
                      <span>
                        {o.title}
                        <span className="mt-1 block text-xs leading-relaxed text-[#c0b4a3]">
                          {o.detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {method === "delivery" && (
                  <div className="mt-5">
                    <label className="text-sm">
                      Address (including unit number)
                      <textarea
                        name="address"
                        required
                        autoComplete="street-address"
                        maxLength={500}
                        className={input}
                      />
                    </label>
                    <label className="text-sm">
                      Singapore postal code
                      <input
                        name="postal"
                        required
                        autoComplete="postal-code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        className={input}
                      />
                    </label>
                  </div>
                )}
              </section>
              <section className={panel}>
                <h2 className="font-marcellus text-2xl">Pay with PayNow</h2>
                <p className="mt-4 text-sm leading-relaxed text-[#c0b4a3]">
                  We’ll check current prices and stock, save your order, then
                  show your final total and PayNow QR. Review the total before
                  paying.
                </p>
                <p className="mt-4 text-sm">
                  {items.reduce((s, i) => s + i.quantity, 0)} records ·{" "}
                  {method === "delivery" ? "$4.50 delivery" : "Free collection"}
                </p>
                <p className="mt-4 text-xs leading-relaxed text-[#c0b4a3]">
                  Your contact details are used to arrange this order. Payment
                  is verified manually. Records are held for 15 minutes after
                  generating your QR. Complete and report payment before the
                  hold expires.
                </p>
                {error && (
                  <p role="alert" className="mt-4 text-sm text-[#f0b8a8]">
                    {error}
                  </p>
                )}
                <button
                  disabled={busy}
                  className="mt-6 min-h-11 w-full rounded-md bg-[#cbb79c] p-3 text-sm text-[#15120f] hover:bg-[#dfcdb3] disabled:opacity-50"
                >
                  {busy ? "Checking your records…" : "Generate PayNow QR ↗"}
                </button>
                <Link
                  to="/cart"
                  className="mt-4 inline-flex min-h-11 items-center text-sm text-[#c0b4a3] underline"
                >
                  Back to cart
                </Link>
              </section>
            </form>
          )}
          {error && order && (
            <p role="alert" className="mt-5 text-sm text-[#f0b8a8]">
              {error} Please wait for the next status check or contact us before
              paying.
            </p>
          )}
          {error && !order && orderId && (
            <div role="alert" className="mt-5 text-sm text-[#f0b8a8]">
              <p>
                {error} If you already paid, contact the shop. Don’t submit or
                pay another order.
              </p>
              <button
                type="button"
                onClick={startAgain}
                className="mt-4 min-h-11 underline"
              >
                Start again (only if you haven’t paid)
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
