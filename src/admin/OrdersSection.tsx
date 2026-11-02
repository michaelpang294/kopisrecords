import OrderLink from "../orders/OrderLink";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminJson } from "./adminApi";
import { formatPrice } from "../cart/cartStorage";
const labels: Record<string, string> = {
  awaiting_payment_confirmation: "Awaiting payment",
  payment_reported: "Payment reported",
  paid: "Paid",
  ready_for_collection: "Ready for collection",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};
type Line = {
  id: number;
  title: string;
  artist?: string;
  quantity: number;
  price: number;
};
type Order = {
  id: string;
  reference: string;
  name: string;
  contact: string;
  address: string;
  postal: string;
  fulfilment: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  expiresAt?: string;
  items: Line[];
  subtotal: number;
  delivery: number;
  total: number;
  events?: { action: string; created_at: string }[];
  holds?: { product_id: number; quantity: number; state: string }[];
};
type List = { orders: Order[]; total: number; page: number; pageSize: number };
const field =
  "min-h-12 rounded-lg border border-white/15 bg-[#211b16] px-3 py-3 text-base text-[#efe8dc] outline-none focus:border-[#cbb79c]";
const button =
  "inline-flex min-h-12 items-center justify-center rounded-md border border-white/15 px-4 py-2 text-sm disabled:opacity-50 hover:border-[#cbb79c]";
const date = (value: string) =>
  new Date(value).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function OrdersSection() {
  const [status, setStatus] = useState("payment_reported"),
    [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [selected, setSelected] = useState("");
  const [list, setList] = useState<{
    key: string;
    data?: List;
    error?: string;
  }>({ key: "" });
  const [detail, setDetail] = useState<{
    key: string;
    order?: Order;
    error?: string;
  }>({ key: "" });
  const [pending, setPending] = useState(""),
    [verified, setVerified] = useState(false),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState("");
  const [issuedLink, setIssuedLink] = useState<{ id: string; token: string }>({
    id: "",
    token: "",
  });
  const [linkBusy, setLinkBusy] = useState(false);
  async function issueLink() {
    if (!order || linkBusy) return;
    const id = order.id;
    setLinkBusy(true);
    setNotice("");
    try {
      const result = await adminJson<{ recoveryToken: string }>(
        `/api/admin/orders/${id}/recovery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      setIssuedLink({ id, token: result.recoveryToken });
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to create the order link.",
      );
    } finally {
      setLinkBusy(false);
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const detailPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && window.matchMedia?.("(max-width: 1279px)").matches)
      detailPanel.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
  }, [selected]);
  const listKey = JSON.stringify([status, query, page, version]),
    detailKey = JSON.stringify([selected, version]);
  useEffect(() => {
    const abort = new AbortController();
    const search = new URLSearchParams({
      status,
      q: query,
      page: String(page),
    });
    adminJson<List>("/api/admin/orders?" + search, { signal: abort.signal })
      .then((data) => setList({ key: listKey, data }))
      .catch((err) => {
        if (!abort.signal.aborted)
          setList({ key: listKey, error: err.message });
      });
    return () => abort.abort();
  }, [status, query, page, version, listKey]);
  useEffect(() => {
    if (!selected) return;
    const abort = new AbortController();
    adminJson<Order>("/api/admin/orders/" + selected, { signal: abort.signal })
      .then((order) => setDetail({ key: detailKey, order }))
      .catch((err) => {
        if (!abort.signal.aborted)
          setDetail({ key: detailKey, error: err.message });
      });
    return () => abort.abort();
  }, [selected, version, detailKey]);
  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
    if (!pending && dialog.current?.open) dialog.current.close();
  }, [pending]);
  const data = list.key === listKey ? list.data : undefined,
    order = detail.key === detailKey ? detail.order : undefined;
  function search(e: FormEvent) {
    e.preventDefault();
    setQuery(draft.trim());
    setPage(1);
  }
  function choose(action: string) {
    setPending(action);
    setVerified(false);
    setActionError("");
  }
  async function confirm() {
    if (!order || busy || !verified) return;
    setBusy(true);
    setActionError("");
    try {
      const result = await adminJson<{ message: string }>(
        `/api/admin/orders/${order.id}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: pending,
            confirmed: true,
            paymentVerified: pending === "paid" && verified,
          }),
        },
      );
      setPending("");
      setNotice(result.message);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update this order.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="orders-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="orders-title" className="font-marcellus text-2xl sm:text-3xl">
            Orders
          </h2>
          <p className="mt-2 text-xs text-[#c0b4a3]">
            Review payments and get records to their next turntable.
          </p>
        </div>
        <button onClick={() => setVersion((v) => v + 1)} className={button}>
          Refresh
        </button>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-col gap-2 text-xs text-[#c0b4a3]">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={field}
          >
            <option value="">All orders</option>
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={search} className="flex flex-1 items-end gap-2">
          <label className="flex flex-1 flex-col gap-2 text-xs text-[#c0b4a3]">
            Find an order
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Reference, name or contact"
              maxLength={120}
              className={`${field} w-full min-w-0`}
            />
          </label>
          <button className={button}>Search</button>
        </form>
      </div>
      {notice && (
        <p role="status" className="mb-4 text-sm text-[#cbb79c]">
          {notice}
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)]">
        <div className={`min-w-0 ${selected ? "hidden xl:block" : ""}`}>
          <p className="mb-3 text-xs text-[#c0b4a3]">
            {data
              ? `${data.total} orders · Page ${page} of ${Math.max(1, Math.ceil(data.total / 30))}`
              : "Loading orders…"}
          </p>
          {list.key === listKey && list.error && (
            <p role="alert" className="py-5 text-sm text-[#f0b8a8]">
              {list.error}
            </p>
          )}
          {data?.orders.length === 0 && (
            <p className="rounded-lg border border-white/10 p-5 text-sm text-[#c0b4a3]">
              No orders found for this filter.
            </p>
          )}
          <div className="space-y-3">
            {data?.orders.map((row) => (
              <button
                key={row.id}
                onClick={() => {
                  setSelected(row.id);
                  setNotice("");
                }}
                aria-pressed={selected === row.id}
                className={`w-full rounded-lg border bg-[#211b16]/95 p-4 text-left ${selected === row.id ? "border-[#cbb79c]" : "border-white/10 hover:border-white/30"}`}
              >
                <span className="flex flex-wrap justify-between gap-2">
                  <span className="break-all text-xs text-[#cbb79c]">
                    {row.reference}
                  </span>
                  <span className="text-xs">{formatPrice(row.total)}</span>
                </span>
                <span className="mt-3 block text-sm">{row.name}</span>
                <span className="mt-1 block text-xs text-[#c0b4a3]">
                  {row.items.reduce((sum, i) => sum + i.quantity, 0)} records ·{" "}
                  {row.fulfilment === "collection" ? "Collection" : "Delivery"}
                </span>
                <span className="mt-3 inline-block rounded-full border border-[#cbb79c]/25 px-2 py-1 text-[11px] text-[#cbb79c]">
                  {labels[row.status] || row.status}
                </span>
                <span className="mt-2 block text-[11px] text-[#c0b4a3]">
                  {date(row.createdAt)} SGT
                </span>
              </button>
            ))}
          </div>
          {data && (
            <div className="mt-4 flex justify-between gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((v) => v - 1)}
                className={button}
              >
                ← Previous
              </button>
              <button
                disabled={page * 30 >= data.total}
                onClick={() => setPage((v) => v + 1)}
                className={button}
              >
                Next →
              </button>
            </div>
          )}
        </div>
        <div
          ref={detailPanel}
          className={`scroll-mt-40 min-w-0 rounded-xl border border-white/10 bg-[#211b16]/95 p-4 sm:p-6 ${selected ? "" : "hidden xl:block"}`}
        >
          {selected && (
            <button
              type="button"
              onClick={() => setSelected("")}
              className={`${button} mb-5 xl:hidden`}
            >
              ← All orders
            </button>
          )}
          {!selected ? (
            <p className="text-sm text-[#c0b4a3]">
              Select an order to review its payment, customer details and
              records.
            </p>
          ) : detail.key === detailKey && detail.error ? (
            <p role="alert" className="text-sm text-[#f0b8a8]">
              {detail.error}
            </p>
          ) : !order ? (
            <p role="status" className="text-sm text-[#c0b4a3]">
              Loading order…
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-[#cbb79c]">
                {labels[order.status] || order.status}
              </p>
              <h3 className="break-all font-marcellus text-xl sm:text-2xl">
                {order.reference}
              </h3>
              <p className="mt-2 text-xs text-[#c0b4a3]">
                {date(order.createdAt)} SGT
              </p>
              <div className="my-5 grid gap-5 border-y border-white/10 py-5 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs uppercase tracking-wider text-[#cbb79c]">
                    Customer
                  </h4>
                  <p className="text-sm">{order.name}</p>
                  <p className="mt-1 break-words text-sm text-[#c0b4a3]">
                    {order.contact}
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 text-xs uppercase tracking-wider text-[#cbb79c]">
                    {order.fulfilment === "collection"
                      ? "Collection"
                      : "Delivery"}
                  </h4>
                  <p className="whitespace-pre-line text-sm text-[#c0b4a3]">
                    {order.fulfilment === "collection"
                      ? "Rocks Cafe\n98 Arab Street, Level 2\nBack Alley Entrance (199794)"
                      : `${order.address}\nSingapore ${order.postal}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={linkBusy}
                onClick={issueLink}
                className={`${button} mb-4 w-full`}
              >
                {linkBusy
                  ? "Creating private link…"
                  : "Get customer order link"}
              </button>
              {issuedLink.id === order.id && (
                <div className="mb-5">
                  <OrderLink token={issuedLink.token} />
                </div>
              )}
              <h4 className="font-marcellus text-xl">Records</h4>
              <ul className="mt-2 divide-y divide-white/10">
                {order.items.map((i) => (
                  <li
                    key={i.id}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      {i.title}
                      <span className="mt-1 block text-xs text-[#c0b4a3]">
                        {i.artist ? `${i.artist} · ` : ""}
                        {i.quantity} × {formatPrice(i.price)}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {formatPrice(i.quantity * i.price)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt>Records</dt>
                  <dd>{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Delivery</dt>
                  <dd>
                    {order.delivery ? formatPrice(order.delivery) : "Free"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-4 text-lg">
                  <dt>Total</dt>
                  <dd>{formatPrice(order.total)}</dd>
                </div>
              </dl>
              {order.status === "payment_reported" && (
                <p className="mt-5 text-xs leading-relaxed text-[#c0b4a3]">
                  Customer reported payment. Check your actual bank receipt
                  against this reference and total before confirming. Their
                  copies remain reserved.
                </p>
              )}
              {order.status === "awaiting_payment_confirmation" && (
                <p className="mt-5 text-xs text-[#c0b4a3]">
                  Waiting for the customer to report payment.{" "}
                  {order.expiresAt
                    ? `Hold ends ${date(order.expiresAt)} SGT.`
                    : "Legacy order: no reservation."}
                </p>
              )}
              {order.status === "expired" && (
                <p className="mt-5 text-xs text-[#c0b4a3]">
                  Hold expired. If payment arrived late, reconcile stock and
                  arrange fulfilment or a refund manually.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                {order.status === "payment_reported" && (
                  <button
                    onClick={() => choose("paid")}
                    className={`${button} bg-[#cbb79c] text-[#15120f]`}
                  >
                    Confirm payment
                  </button>
                )}
                {!["paid", "cancelled"].includes(order.paymentStatus) && (
                  <button
                    onClick={() => choose("cancel")}
                    className={`${button} text-[#f0b8a8]`}
                  >
                    Cancel order
                  </button>
                )}
                {order.status === "paid" && (
                  <button
                    onClick={() =>
                      choose(
                        order.fulfilment === "collection"
                          ? "ready_for_collection"
                          : "dispatched",
                      )
                    }
                    className={button}
                  >
                    {order.fulfilment === "collection"
                      ? "Mark ready for collection"
                      : "Mark dispatched"}
                  </button>
                )}
                {["ready_for_collection", "dispatched"].includes(
                  order.status,
                ) && (
                  <button
                    onClick={() => choose("completed")}
                    className={button}
                  >
                    Mark completed
                  </button>
                )}
              </div>
              {(order.events?.length || 0) > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <h4 className="mb-3 font-marcellus text-lg">
                    Order activity
                  </h4>
                  <ul className="space-y-2 text-xs text-[#c0b4a3]">
                    {order.events?.map((event, i) => (
                      <li key={i}>
                        {labels[event.action] || event.action} ·{" "}
                        {date(event.created_at)} SGT
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setPending("");
        }}
        className="m-auto w-[calc(100%_-_32px)] max-h-[calc(100dvh_-_32px)] max-w-md overflow-y-auto rounded-lg border border-white/20 bg-[#211b16] p-6 text-[#efe8dc] backdrop:bg-black/70"
      >
        <h3 className="font-marcellus text-2xl">
          {pending === "paid"
            ? "Confirm bank receipt"
            : pending === "cancel"
              ? "Cancel this order?"
              : "Update fulfilment?"}
        </h3>
        <p className="mt-4 break-all text-sm">
          {order?.reference} · {order ? formatPrice(order.total) : ""}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#c0b4a3]">
          {pending === "paid"
            ? "This marks payment confirmed and deducts the ordered stock once."
            : pending === "cancel"
              ? "This releases the stock reservation. Check your bank first if the customer reported payment. It does not refund a transfer."
              : "This updates fulfilment only. Contact the customer separately; no automatic message is sent."}
        </p>
        <label className="mt-5 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            className="mt-1 accent-[#cbb79c]"
          />
          <span>
            {pending === "paid"
              ? "I checked my bank and verified this reference and amount."
              : "I have reviewed this order and confirm this action."}
          </span>
        </label>
        {actionError && (
          <p role="alert" className="mt-4 text-sm text-[#f0b8a8]">
            {actionError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled={busy || !verified}
            onClick={confirm}
            className={`${button} bg-[#cbb79c] text-[#15120f]`}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button
            disabled={busy}
            onClick={() => setPending("")}
            className={button}
          >
            Back
          </button>
        </div>
      </dialog>
    </section>
  );
}
