import { ClipboardList, Plus, Disc3, Package } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { NavLink, useParams } from "react-router-dom";
import Footer from "../footer";
import background from "../assets/backgrounds/second-slide-bg.png";
import CreateProductSection from "../actions/CreateProduct";
import UpdateProductSection from "../actions/UpdateProduct";
import StockLevelsSection from "../actions/StockLevels";
import OrdersSection from "../admin/OrdersSection";
import { API, adminJson } from "../admin/adminApi";
const links = [
  { label: "Orders", icon: ClipboardList, to: "/admin/orders" },
  { label: "Add record", icon: Plus, to: "/admin/create" },
  { label: "Edit records", icon: Disc3, to: "/admin/edit" },
  { label: "Stock", icon: Package, to: "/admin/stock" },
];
export default function AdminPage() {
  const { action } = useParams();
  const [auth, setAuth] = useState<"checking" | "signed-in" | "signed-out">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(API + "/api/admin/session", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok && res.status !== 401)
          throw new Error("Unable to check admin access.");
        if (active) {
          setAuth(res.ok ? "signed-in" : "signed-out");
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setAuth("signed-out");
          setError(err.message || "Unable to connect to the server.");
        }
      });
    function ended() {
      setAuth("signed-out");
      setError("Your session ended. Please sign in again.");
    }
    window.addEventListener("admin-session-ended", ended);
    return () => {
      active = false;
      window.removeEventListener("admin-session-ended", ended);
    };
  }, [attempt]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await adminJson("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setAuth("signed-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (
      !window.dispatchEvent(
        new window.Event("admin-before-leave", { cancelable: true }),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminJson("/api/admin/logout", { method: "POST" });
      setAuth("signed-out");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <main
        className="min-h-[calc(100svh-57px)] bg-[#15120f] bg-cover bg-center px-4 py-5 font-[Arial,sans-serif] text-[#efe8dc] sm:px-6 lg:px-10"
        style={{
          backgroundImage: `linear-gradient(#15120fe8,#15120ff2),url(${background})`,
        }}
      >
        <div className="mx-auto max-w-[1440px]">
          {auth === "checking" ? (
            <p role="status">Checking admin access…</p>
          ) : auth !== "signed-in" ? (
            <form
              onSubmit={login}
              className="mx-auto my-8 max-w-sm rounded-lg border border-white/10 bg-[#211b16] p-6 sm:my-16"
            >
              <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
                Behind the crates
              </p>
              <h1 className="mb-6 font-marcellus text-3xl">Admin sign-in</h1>
              <label className="block text-sm">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 block min-h-11 w-full rounded-md border border-white/15 bg-[#15120f] p-3 text-base outline-none focus:border-[#cbb79c]"
                />
              </label>
              {error && (
                <p role="alert" className="mt-4 text-sm text-[#f0b8a8]">
                  {error}
                </p>
              )}
              <button
                disabled={busy}
                className="mt-6 min-h-11 w-full rounded-md bg-[#cbb79c] p-3 text-sm text-[#15120f] disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Sign in ↗"}
              </button>
              <button
                type="button"
                onClick={() => setAttempt((v) => v + 1)}
                className="mt-3 min-h-11 text-xs text-[#c0b4a3] underline"
              >
                Check connection again
              </button>
            </form>
          ) : (
            <>
              <header className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[.18em] text-[#cbb79c]">
                    Kopi’s Records · Administration
                  </p>
                  <h1 className="font-marcellus text-2xl sm:text-4xl">
                    Behind the crates
                  </h1>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={logout}
                  className="min-h-11 rounded-md border border-white/20 px-4 text-sm text-[#c0b4a3]"
                >
                  Sign out
                </button>
              </header>
              {error && (
                <p role="alert" className="mb-4 text-sm text-[#f0b8a8]">
                  {error}
                </p>
              )}
              <div className="grid items-start gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
                <nav
                  aria-label="Admin navigation"
                  className="sticky top-[57px] z-30 grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-[#211b16]/95 p-1.5 backdrop-blur-xl sm:top-[81px] lg:top-24 lg:grid-cols-1"
                >
                  {links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `inline-flex min-h-14 flex-col gap-1 items-center justify-center rounded-lg px-1 py-3 text-center text-xs sm:text-sm lg:flex-row lg:gap-3 lg:justify-start lg:px-4 ${isActive || (link.to === "/admin/orders" && !action) ? "bg-[#cbb79c] text-[#15120f]" : "border border-white/10 bg-[#211b16] text-[#c0b4a3] hover:text-[#efe8dc]"}`
                      }
                    >
                      <link.icon size={17} aria-hidden="true" />
                      {link.label}
                    </NavLink>
                  ))}
                </nav>
                <div className="min-w-0">
                  {action === "create" ? (
                    <CreateProductSection />
                  ) : action === "edit" ? (
                    <UpdateProductSection />
                  ) : action === "stock" ? (
                    <StockLevelsSection />
                  ) : (
                    <OrdersSection />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
