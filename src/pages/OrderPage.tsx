import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API } from "../admin/adminApi";
import Footer from "../footer";
import background from "../assets/backgrounds/second-slide-bg.png";
import { formatPrice } from "../cart/cartStorage";
import { useCart } from "../cart/CartContext";
import OrderLink from "../orders/OrderLink";
import {
  checkoutIdForToken,
  clearActiveCheckout,
  validToken,
  type RecoveredOrder,
} from "../orders/orderRecovery";
export default function OrderPage() {
  const { hash } = useLocation(),
    token = new URLSearchParams(hash.replace(/^#/, "")).get("token") || "";
  const [result, setResult] = useState<{
      token: string;
      order?: RecoveredOrder;
      error?: string;
    }>({ token: "" }),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [reportError, setReportError] = useState(""),
    [now, setNow] = useState(() => Date.now());
  const offset = useRef(0),
    reported = useRef("");
  const { completeOrder } = useCart();
  const order = result.token === token ? result.order : undefined,
    error = result.token === token ? result.error : undefined;
  useEffect(() => {
    if (!validToken(token)) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const response = await fetch(API + "/api/order-recovery", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const value = await response.json();
        if (!response.ok)
          throw Error(value.error || "Unable to load this order.");
        if (!active) return;
        // A pre-report poll must not restore a payable QR after a successful report.
        if (
          reported.current === token &&
          value.status === "awaiting_payment_confirmation"
        )
          return;
        offset.current = Date.parse(value.serverTime) - Date.now();
        setNow(Date.now() + offset.current);
        setResult({ token, order: value });
      } catch (err) {
        if (active && !controller.signal.aborted)
          setResult({
            token,
            error:
              err instanceof Error
                ? err.message
                : "Unable to check this order.",
          });
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [token, version]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = order?.expiresAt
      ? Math.max(0, Math.ceil((Date.parse(order.expiresAt) - now) / 1000))
      : 0,
    activeHold =
      order?.status === "awaiting_payment_confirmation" && seconds > 0;
  async function report() {
    if (busy || !activeHold) return;
    setBusy(true);
    setReportError("");
    try {
      const response = await fetch(
        API + "/api/order-recovery/payment-reported",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      const value = await response.json();
      if (!response.ok) throw Error(value.error || "Unable to report payment.");
      reported.current = token;
      setResult({ token, order: value });
      // Only this browser's own checkout can settle its cart. Opening a recovery link never does.
      const owned = checkoutIdForToken(token);
      if (owned) {
        completeOrder(owned, value.items);
        clearActiveCheckout(owned);
      }
    } catch (err) {
      setReportError(
        err instanceof Error
          ? err.message
          : "Unable to report payment. Contact us with your reference.",
      );
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    awaiting_payment_confirmation: "Your records are on hold",
    payment_reported: "Payment update received",
    paid: "Payment confirmed",
    ready_for_collection: "Ready for collection",
    dispatched: "Your records are on their way",
    completed: "Order completed",
    cancelled: "Order cancelled",
    expired: "Your hold has expired",
  };
  const message =
    order?.status === "payment_reported"
      ? "We’ll verify your payment and contact you to arrange collection or delivery. You don’t need to pay again."
      : order?.status === "paid"
        ? "Your payment has been confirmed. We’ll contact you about collection or delivery."
        : order?.status === "ready_for_collection"
          ? "Your order is ready. Please follow the collection arrangements confirmed with the shop."
          : order?.status === "dispatched"
            ? "Your order has been marked dispatched. Contact us with your reference if you need help."
            : order?.status === "completed"
              ? "Thanks for shopping with Kopi’s. We hope these records find a place in your rotation."
              : order?.status === "cancelled"
                ? "This order is closed. Do not pay its QR. If you already transferred money, contact us."
                : "Do not pay an expired QR. If you already paid, contact us with your reference. Please don’t pay again.";
  return (
    <>
      <main
        id="main-content"
        className="min-h-screen bg-[#15120f] bg-cover bg-center px-4 py-7 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6"
        style={{
          backgroundImage: `linear-gradient(#15120fe8,#15120ff2),url(${background})`,
        }}
      >
        <div className="mx-auto max-w-[960px]">
          <Link
            to="/shop"
            className="mb-5 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline"
          >
            ← Back to shop
          </Link>
          <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
            Your next rotation
          </p>
          <h1 className="mb-6 font-marcellus text-3xl sm:text-4xl">
            Your order
          </h1>
          {!validToken(token) ? (
            <div
              role="alert"
              className="rounded-xl border border-white/10 bg-[#211b16] p-5"
            >
              <p>
                This link is incomplete. Use the full private link you saved, or
                contact us with your order reference.
              </p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-xl border border-white/10 bg-[#211b16] p-5"
            >
              <p className="text-sm text-[#c0b4a3]">
                {error} Your link may not be ready if checkout did not finish.
                If you paid, don’t pay again; contact the shop.
              </p>
              <button
                onClick={() => setVersion((v) => v + 1)}
                className="mt-4 min-h-11 text-sm text-[#cbb79c] underline"
              >
                Try again
              </button>
            </div>
          ) : !order ? (
            <p role="status" className="text-sm text-[#c0b4a3]">
              Checking your order…
            </p>
          ) : (
            <div className="grid items-start gap-5 md:grid-cols-2">
              <section className="rounded-xl border border-white/10 bg-[#211b16]/95 p-5 sm:p-6">
                <h2 className="font-marcellus text-2xl">
                  {activeHold
                    ? labels.awaiting_payment_confirmation
                    : labels[order.status] || "Your hold has expired"}
                </h2>
                {activeHold ? (
                  <>
                    <p role="timer" className="mt-3 text-sm text-[#cbb79c]">
                      Time remaining: {Math.floor(seconds / 60)}:
                      {String(seconds % 60).padStart(2, "0")}
                    </p>
                    <p className="mt-3 text-sm text-[#c0b4a3]">
                      PayNow to{" "}
                      <strong className="text-[#efe8dc]">91470168</strong>.
                      Check the bank’s registered recipient and total before
                      paying.
                    </p>
                    {order.qr && (
                      <>
                        <img
                          src={order.qr}
                          alt={`PayNow QR for ${formatPrice(order.total)}`}
                          className="mx-auto my-5 w-full max-w-[260px] rounded-lg"
                        />
                        <a
                          href={order.qr}
                          download={`${order.reference}-paynow.png`}
                          className="inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline"
                        >
                          Save QR ↓
                        </a>
                      </>
                    )}
                    <p className="mt-3 text-xs leading-relaxed text-[#c0b4a3]">
                      Report payment before the hold ends. A saved QR may still
                      accept money after expiry; do not use it once the hold
                      ends.
                    </p>
                    <button
                      disabled={busy}
                      onClick={report}
                      className="mt-5 min-h-12 w-full rounded-lg bg-[#cbb79c] p-3 text-sm text-[#15120f] disabled:opacity-50"
                    >
                      {busy ? "Submitting…" : "I’ve made payment"}
                    </button>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-[#c0b4a3]">
                    {message}
                  </p>
                )}
                {reportError && (
                  <p role="alert" className="mt-4 text-sm text-[#f0b8a8]">
                    {reportError}
                  </p>
                )}
                <OrderLink token={token} />
              </section>
              <section className="rounded-xl border border-white/10 bg-[#211b16]/95 p-5 sm:p-6">
                <h2 className="font-marcellus text-2xl">Order summary</h2>
                <p className="mt-3 break-all text-sm text-[#cbb79c]">
                  {order.reference}
                </p>
                <ul className="mt-5 divide-y divide-white/10">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span>
                        {item.quantity} × {item.title}
                        {item.artist && (
                          <span className="mt-1 block text-xs text-[#c0b4a3]">
                            {item.artist}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </span>
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
                      {order.fulfilment === "delivery"
                        ? "Delivery"
                        : "Collection"}
                    </dt>
                    <dd>
                      {order.delivery ? formatPrice(order.delivery) : "Free"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-4 text-lg">
                    <dt>Total</dt>
                    <dd>{formatPrice(order.total)}</dd>
                  </div>
                </dl>
                {order.fulfilment === "collection" && (
                  <p className="mt-5 text-xs leading-relaxed text-[#c0b4a3]">
                    Collection at Rocks Cafe, 98 Arab Street, Level 2, Back
                    Alley Entrance, Singapore 199794. Wait for the shop to
                    confirm arrangements.
                  </p>
                )}
                <a
                  href={`mailto:kopisrecords@gmail.com?subject=${encodeURIComponent(`Order ${order.reference}`)}`}
                  className="mt-5 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline"
                >
                  Contact us about this order ↗
                </a>
                <Link
                  to="/shop"
                  className="mt-4 flex min-h-12 items-center justify-center rounded-lg border border-white/15 px-4 text-sm text-[#efe8dc]"
                >
                  Continue shopping ↗
                </Link>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
