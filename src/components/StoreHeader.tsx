import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { typography as type } from "../styles/typography";
import { useCart } from "../cart/CartContext";

const navigationLink = `${type.ui} block py-[13px] text-[#efe8dc] transition-colors hover:text-[#cbb79c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4 max-[1000px]:border-t max-[1000px]:border-white/10 motion-reduce:transition-none`;

export default function StoreHeader() {
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <header
      className={`${type.body} sticky top-0 z-50 border-b border-white/10 bg-[#12100e]/95 text-[#efe8dc] backdrop-blur-[16px]`}
    >
      <a
        href="#main-content"
        className={`${type.ui} fixed left-3 -top-24 z-[100] bg-[#15120f] px-4 py-3 text-[#efe8dc] focus:top-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c]`}
      >
        Skip to content
      </a>

      <div className="mx-auto grid w-[calc(100%-36px)] max-w-[1320px] grid-cols-[1fr_auto] grid-rows-[56px_auto] items-center gap-x-4 min-[641px]:w-[calc(100%-48px)] min-[641px]:grid-rows-[80px_auto] min-[1001px]:grid-rows-[80px] min-[641px]:gap-x-6 min-[1001px]:w-[calc(100%-80px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px]">
        <Link
          to="/"
          className={`${type.brand} col-start-1 row-start-1 justify-self-start whitespace-nowrap text-[#efe8dc] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-4`}
        >
          Kopi’s Records
        </Link>

        <button
          ref={trigger}
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="store-navigation"
          onClick={() => setOpen((previous) => !previous)}
          className="relative col-start-2 row-start-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center justify-self-end rounded border-0 bg-transparent p-0 text-[#efe8dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-2 min-[1001px]:hidden"
        >
          <span
            aria-hidden="true"
            className={`absolute h-px w-6 bg-current transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-45" : "-translate-y-1"}`}
          />
          <span
            aria-hidden="true"
            className={`absolute h-px w-6 bg-current transition-transform duration-200 motion-reduce:transition-none ${open ? "-rotate-45" : "translate-y-1"}`}
          />
        </button>

        <nav
          id="store-navigation"
          aria-label="Main navigation"
          className={`col-span-2 col-start-1 row-start-2 flex-col pb-0 min-[1001px]:col-span-1 min-[1001px]:col-start-2 min-[1001px]:row-start-1 min-[1001px]:flex-row min-[1001px]:items-center min-[1001px]:justify-self-end min-[1001px]:gap-5 min-[1001px]:pb-0 min-[1201px]:gap-[30px] ${open ? "flex" : "hidden min-[1001px]:flex"}`}
        >
          <Link to="/shop?sort=newest" className={navigationLink}>
            New arrivals
          </Link>
          <Link to="/shop" className={navigationLink}>
            Shop all
          </Link>
          <Link to="/request" className={navigationLink}>
            Request a record
          </Link>
          <Link
            to="/blog"
            className={navigationLink}
            aria-current={
              location.pathname.startsWith("/blog") ? "page" : undefined
            }
          >
            Blog
          </Link>
          <Link
            to="/cart"
            aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            aria-current={location.pathname === "/cart" ? "page" : undefined}
            className={`${navigationLink} relative inline-flex items-center gap-2`}
          >
            Cart
            {itemCount > 0 && (
              <span
                aria-hidden="true"
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cbb79c] px-1 font-[family-name:Arial,sans-serif] text-[10px] leading-none text-[#15120f] min-[1001px]:absolute min-[1001px]:-right-3 min-[1001px]:top-1"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
