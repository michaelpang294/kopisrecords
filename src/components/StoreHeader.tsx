import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function StoreHeader() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-[#ffffff12] bg-[#12100ef2] text-[#efe8dc] backdrop-blur-[16px]">
      <a className="fixed left-3 -top-[100px] z-[100] bg-[#15120f] p-3 focus:top-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-[5px]" href="#main-content">
        Skip to content
      </a>
      <div className="mx-auto w-[calc(100%-80px)] max-w-[1320px] max-[1000px]:w-[calc(100%-48px)] max-[640px]:w-[calc(100%-36px)] min-[1800px]:w-[calc(100%-120px)] min-[1800px]:max-w-[1440px] flex min-h-20 items-center justify-between gap-6 max-[640px]:min-h-[68px] max-[640px]:flex-wrap max-[640px]:gap-0">
        <Link className="font-[Marcellus,Georgia,serif] font-normal leading-[1.12] whitespace-nowrap text-[30px] max-[640px]:text-[25px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-[5px]" to="/">
          Kopi’s Records
        </Link>
        <button
          ref={trigger}
          className="hidden min-h-11 cursor-pointer rounded border border-[#ffffff30] bg-transparent px-3 py-2 text-xs max-[640px]:block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#cbb79c] focus-visible:outline-offset-[5px]"
          aria-expanded={open}
          aria-controls="store-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close ×" : "Menu ☰"}
        </button>
        <nav
          id="store-navigation"
          className={`items-center gap-[30px] text-sm [&_a]:py-3 [&_a:hover]:text-[#cbb79c] [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-[#cbb79c] [&_a:focus-visible]:outline-offset-[5px] max-[1000px]:gap-5 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-0 max-[640px]:pt-2.5 max-[640px]:pb-5 max-[640px]:[&_a]:border-t max-[640px]:[&_a]:border-[#ffffff15] max-[640px]:[&_a]:py-[13px] ${open ? "flex" : "hidden min-[641px]:flex"}`}
          aria-label="Main navigation"
        >
          <Link to="/shop?sort=newest">New arrivals</Link>
          <Link to="/shop">Shop all</Link>
          <Link to="/request">Request a record</Link>
          <Link to="/cart">Cart</Link>
        </nav>
      </div>
    </header>
  );
}
