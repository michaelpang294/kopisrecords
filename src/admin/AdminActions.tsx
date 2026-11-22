import { useId, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { ChevronDown } from "lucide-react";

type ActionLink = {
  label: string;
  to: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: "true" }>;
};
export default function AdminActions({ action, links }: { action?: string; links: ActionLink[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const current = links.find(link => link.to === `/admin/${action || "orders"}`)?.label || "Orders";
  return (
    <nav aria-label="Admin navigation" className="sticky top-[57px] z-30 self-start rounded-xl border border-white/10 bg-[#211b16]/95 p-1.5 backdrop-blur-xl sm:top-[81px] lg:top-24">
      <button type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#efe8dc] sm:hidden">
        <span><span className="text-[#c0b4a3]">Actions</span><span aria-hidden="true"> · </span>{current}</span>
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={menuId} className={`${open ? "grid" : "hidden"} max-h-[55svh] grid-cols-3 gap-1 overflow-y-auto sm:grid sm:max-h-none sm:grid-cols-4 lg:grid lg:max-h-none lg:grid-cols-1 lg:overflow-visible`}>
        {links.map(link => (
          <NavLink key={link.to} to={link.to} onClick={() => setOpen(false)} className={({ isActive }) =>
            `inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-3 text-center text-xs sm:text-sm lg:flex-row lg:justify-start lg:gap-3 lg:px-4 ${isActive || (link.to === "/admin/orders" && !action) ? "bg-[#cbb79c] text-[#15120f]" : "border border-white/10 bg-[#211b16] text-[#c0b4a3] hover:text-[#efe8dc]"}`
          }>
            <link.icon size={17} aria-hidden="true" />{link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
