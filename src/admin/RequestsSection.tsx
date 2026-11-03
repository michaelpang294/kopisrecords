import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";
import { adminJson } from "./adminApi";

type RecordRequest = {
  id: string;
  name: string;
  email: string;
  contact: string;
  record: string;
  notes: string;
  emailStatus: string;
  createdAt: string;
};
type RequestList = {
  requests: RecordRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
const statuses: Record<string, string> = {
  pending: "Email pending",
  sending: "Email processing",
  sent: "Email sent",
  failed: "Email failed",
};
const field =
  "min-h-12 w-full rounded-lg border border-white/15 bg-[#15120f] px-3 py-2 text-base text-[#efe8dc] outline-none focus:border-[#cbb79c]";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 text-sm text-[#cbb79c] hover:bg-[#30271f] disabled:opacity-40";
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleString("en-SG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Singapore",
      });
}

export default function RequestsSection() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = new URLSearchParams({
    q: search,
    emailStatus: filter,
    page: String(page),
  }).toString();
  const key = `${query}|${refresh}`;
  const [result, setResult] = useState<{
    key: string;
    data?: RequestList;
    error?: string;
  }>({ key: "" });
  const data = result.key === key ? result.data : undefined;
  const error = result.key === key ? result.error : undefined;
  const loading = !data && !error;
  useEffect(() => {
    const controller = new AbortController();
    adminJson<RequestList>("/api/admin/record-requests?" + query, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setResult({ key, data: value });
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              err instanceof Error ? err.message : "Unable to load requests.",
          });
      });
    return () => controller.abort();
  }, [key, query]);
  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim());
    setPage(1);
    setExpanded(null);
    setRefresh((v) => v + 1);
  }
  return (
    <section
      aria-labelledby="requests-title"
      className="min-w-0 rounded-xl border border-white/10 bg-[#211b16]/95 p-4 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="requests-title"
            className="font-marcellus text-2xl sm:text-3xl"
          >
            Record requests
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#c0b4a3]">
            Customer wishlists, contact details and confirmation emails.
          </p>
        </div>
        <button
          type="button"
          className={button}
          onClick={() => setRefresh((v) => v + 1)}
          aria-label="Refresh record requests"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>
      <form
        onSubmit={find}
        className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_220px]"
      >
        <label className="block min-w-0 text-xs text-[#c0b4a3]">
          Search requests
          <input
            value={draft}
            maxLength={200}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Record, customer, email or notes"
            className={`${field} mt-2`}
            type="search"
          />
        </label>
        <button type="submit" className={`${button} self-end !min-h-12`}>
          <Search size={16} aria-hidden="true" />
          Search
        </button>
        <label className="block text-xs text-[#c0b4a3] sm:col-span-2 lg:col-span-1">
          Confirmation email
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
              setExpanded(null);
            }}
            className={`${field} mt-2`}
          >
            <option value="">All email statuses</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </form>
      {loading ? (
        <p role="status" className="py-8 text-sm text-[#c0b4a3]">
          Loading requests…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-lg border border-[#f0b8a8]/25 p-4 text-sm text-[#f0b8a8]"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((v) => v + 1)}
            className={`${button} mt-3`}
          >
            Try again
          </button>
        </div>
      ) : (
        data && (
          <>
            <p role="status" className="mb-4 text-xs text-[#c0b4a3]">
              {data.total} {data.total === 1 ? "request" : "requests"}
              {data.total > 0 && ` · Page ${data.page} of ${data.totalPages}`}
            </p>
            {data.requests.length === 0 ? (
              <p className="rounded-lg border border-white/10 p-6 text-sm text-[#c0b4a3]">
                {search || filter
                  ? "No requests match these filters."
                  : "No record requests yet. New customer requests will appear here."}
              </p>
            ) : (
              <div className="grid items-start gap-3 xl:grid-cols-2">
                {data.requests.map((request) => {
                  const open = expanded === request.id;
                  return (
                    <article
                      key={request.id}
                      className="min-w-0 rounded-lg border border-white/10 bg-[#15120f]/60 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <time
                          dateTime={request.createdAt}
                          className="text-xs text-[#c0b4a3]"
                        >
                          {date(request.createdAt)} SGT
                        </time>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${request.emailStatus === "failed" ? "border-[#f0b8a8]/30 text-[#f0b8a8]" : "border-[#cbb79c]/25 text-[#cbb79c]"}`}
                        >
                          {statuses[request.emailStatus] || request.emailStatus}
                        </span>
                      </div>
                      <h3 className="break-words font-marcellus text-xl leading-snug">
                        {request.record}
                      </h3>
                      <p className="mt-3 break-words text-sm">{request.name}</p>
                      <p className="mt-1 break-all text-sm text-[#c0b4a3]">
                        {request.email}
                      </p>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`request-${request.id}`}
                        className={`${button} mt-4 w-full`}
                        onClick={() => setExpanded(open ? null : request.id)}
                      >
                        {open ? "Hide details" : "View request"}
                        {open ? (
                          <ChevronUp size={16} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={16} aria-hidden="true" />
                        )}
                      </button>
                      {open && (
                        <div
                          id={`request-${request.id}`}
                          className="mt-4 border-t border-white/10 pt-4"
                        >
                          <dl className="space-y-4 text-sm">
                            <div>
                              <dt className="mb-1 text-xs text-[#c0b4a3]">
                                Phone / Telegram
                              </dt>
                              <dd className="break-words">
                                {request.contact || "Not provided"}
                              </dd>
                            </div>
                            <div>
                              <dt className="mb-1 text-xs text-[#c0b4a3]">
                                Extra details
                              </dt>
                              <dd className="whitespace-pre-wrap break-words leading-6">
                                {request.notes || "No extra details provided."}
                              </dd>
                            </div>
                            <div>
                              <dt className="mb-1 text-xs text-[#c0b4a3]">
                                Request ID
                              </dt>
                              <dd className="break-all text-xs">
                                {request.id}
                              </dd>
                            </div>
                          </dl>
                          {request.emailStatus === "failed" && (
                            <p className="mt-3 text-xs leading-5 text-[#c0b4a3]">
                              The request is saved. Its automatic confirmation
                              failed; you can contact the customer directly.
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {data.totalPages > 1 && (
              <nav
                aria-label="Request pages"
                className="mt-5 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  className={button}
                  disabled={data.page <= 1}
                  onClick={() => {
                    setPage(data.page - 1);
                    setExpanded(null);
                  }}
                >
                  Previous
                </button>
                <span className="text-xs text-[#c0b4a3]">
                  {data.page} / {data.totalPages}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={data.page >= data.totalPages}
                  onClick={() => {
                    setPage(data.page + 1);
                    setExpanded(null);
                  }}
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}
