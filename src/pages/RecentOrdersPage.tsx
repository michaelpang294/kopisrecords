import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../footer";
import { formatPrice } from "../cart/cartStorage";
import {
  recentOrders,
  removeRecent,
  recoveryPath,
  subscribeOrders,
} from "../orders/orderRecovery";
const labels: Record<string, string> = {
  creating: "Checkout in progress",
  awaiting_payment_confirmation: "Awaiting payment",
  payment_reported: "Awaiting verification",
  paid: "Paid",
  ready_for_collection: "Ready for collection",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Hold expired",
};
export default function RecentOrdersPage() {
  const [orders, setOrders] = useState(recentOrders);
  useEffect(() => subscribeOrders(() => setOrders(recentOrders())), []);
  return (
    <>
      <main
        id="main-content"
        className="min-h-[calc(100svh-57px)] bg-[#15120f] px-4 py-8 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6"
      >
        <div className="mx-auto max-w-[760px]">
          <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
            Back to your rotation
          </p>
          <h1 className="font-marcellus text-3xl sm:text-4xl">
            Your recent orders
          </h1>
          <p className="my-5 text-sm leading-relaxed text-[#c0b4a3]">
            Saved on this browser only. Open an order to check its latest
            status. On another device, use your copied private order link.
          </p>
          {!orders.length ? (
            <section className="rounded-xl border border-white/10 bg-[#211b16] p-5">
              <p className="text-sm text-[#c0b4a3]">
                No orders saved here yet. If you placed an order elsewhere, open
                its private link or contact us with your reference.
              </p>
              <Link
                to="/shop"
                className="mt-5 inline-flex min-h-11 items-center text-sm text-[#cbb79c] underline"
              >
                Explore the records ↗
              </Link>
            </section>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => (
                <li
                  key={order.token}
                  className="rounded-xl border border-white/10 bg-[#211b16] p-4"
                >
                  <Link
                    to={recoveryPath(order.token)}
                    className="block min-h-11"
                  >
                    <span className="flex flex-wrap justify-between gap-3">
                      <span className="break-all text-sm text-[#efe8dc]">
                        {order.reference}
                      </span>
                      {typeof order.total === "number" && order.total > 0 && (
                        <span className="text-sm text-[#cbb79c]">
                          {formatPrice(order.total)}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-xs text-[#c0b4a3]">
                      Last seen: {labels[order.status] || order.status}
                    </span>
                    <span className="mt-3 block text-sm text-[#cbb79c]">
                      View order ↗
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this saved link from this browser? This does not cancel the order.",
                        )
                      )
                        removeRecent(order.token);
                    }}
                    className="mt-2 min-h-11 text-xs text-[#c0b4a3] underline"
                  >
                    Remove from this browser
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs leading-relaxed text-[#c0b4a3]">
            Clearing browser data removes these saved links. Keep a copy of the
            private link for any order you need. Removing a link does not cancel
            an order or release its stock hold.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
