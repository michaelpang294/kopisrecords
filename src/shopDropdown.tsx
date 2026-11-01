import { useState, useRef, useEffect } from "react";
import { shopCategories } from "./scripts/picksOfTheWeek";

export default function ShopDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={dropdownRef}
      className="relative inline-block"
    >
      <button
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen((prev) => !prev)}
        className="hover:underline hover:cursor-pointer"
      >
        Shop &#11087;
      </button>

      {open && (
        <div 
            className="absolute top-full right-0 mt-2 w-40 bg-[#cbb79c] shadow-lg rounded-md overflow-hidden z-50 flex flex-col"
            onMouseLeave={() => setOpen(false)}
        >
          {shopCategories.map((item) => (
            <a
              key={item.name}
              href={item.link}
              className="block px-3 py-2 text-sm hover:bg-gray-100 duration-300 text-black"
            >
              {item.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}