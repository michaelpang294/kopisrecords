import { useState } from "react";
import ShopDropdown from "./shopDropdown";
import { Menu, X } from "lucide-react";

export default function MobileNavBar() {
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* Top Bar */}
      <header className="2xl:hidden sticky top-0 h-12 w-full z-50 bg-black/40 backdrop-blur-md text-white px-5 flex justify-between items-center">
        <a href="/">
          <p
            className={`text-xl ${
              open ? "opacity-20 visible transition-opacity duration-300" : "opacity-100 visible"
            }`}
          >
            Kopi's Records
          </p>
        </a>

        <button onClick={() => setOpen(true)}><Menu /></button>
      </header>

      {/* Overlay */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black/80 z-40 transition-opacity duration-300 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full bg-[#1a1a1a] text-white z-50 duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header inside sidebar */}
        <div className="flex justify-between justify-end items-center p-5 border-b border-white/10 w-full gap-x-2">
          <p>Menu</p>
          <button onClick={handleClose}><X /></button>
        </div>

        {/* Links */}
        <div className="flex flex-col gap-4 p-5 text-sm">
          <a href="/shop" onClick={handleClose}>Shop All</a>
          <a href="/requests" onClick={handleClose}>Request</a>
          <a href="/cart" onClick={handleClose}>Cart</a>
        </div>
      </div>
    </>
  );
}