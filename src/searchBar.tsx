import { RefreshCcw, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Product } from "./scripts/picksOfTheWeek";

type SearchBarProps = {
  products: Product[];
  setActiveQuery: (q: string) => void;
  setFilteredProducts: (p: Product[]) => void;
};

type ActionSearchBarProps = {
  products: Product[];
  setFilteredProducts: (p: Product[]) => void;
};

export default function SearchBar({
  products,
  setActiveQuery,
  setFilteredProducts,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-full 2xl:max-w-xl pb-4">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <RefreshCcw size={14} className="text-black/60 animate-spin" />
          ) : hasResults ? (
            <X
              size={14}
              className="cursor-pointer text-black/60"
              onClick={() => {
                setQuery("");
                setShowDropdown(false);
                setHasResults(false);
                setActiveQuery("");
                setFilteredProducts(products);
              }}
            />
          ) : (
            <Search size={14} className="text-black/60" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLoading(true);
            if (e.target.value.trim().length > 1) {
              const searchResults = products.filter(
                (p) =>
                  p.title
                    .toLowerCase()
                    .includes(e.target.value.toLowerCase()) ||
                  p.artist
                    .toLowerCase()
                    .includes(e.target.value.toLowerCase()) ||
                  p.genre.toLowerCase().includes(e.target.value.toLowerCase()),
              );

              setLoading(false);
              setSuggestions(searchResults);
              setShowDropdown(searchResults.length > 0);
              if (searchResults.length > 0) {
                setShowDropdown(true);
                setHasResults(true);
                setLoading(false);
                setSuggestions(searchResults);
              }
            } else if (e.target.value.trim().length === 0) {
              setShowDropdown(false);
              setHasResults(false);
              setLoading(false);
              setFilteredProducts(products);
              setActiveQuery("");
            } else {
              setLoading(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const q = query.trim().toLowerCase();

              setActiveQuery(q);

              if (!q) {
                setFilteredProducts(products);
                setShowDropdown(false);
                return;
              }

              const results = products.filter(
                (p) =>
                  p.title.toLowerCase().includes(q) ||
                  p.artist.toLowerCase().includes(q) ||
                  p.genre.toLowerCase().includes(q),
              );

              setFilteredProducts(results);
              setShowDropdown(false);
            }
          }}
          placeholder="Search for an album here"
          className="w-full rounded bg-white text-black px-9 2xl:py-1 py-2 font-marcellus placeholder:text-black focus:outline-none 2xl:text-base text-xs"
        />
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 w-full bg-black backdrop-blur-md mt-1 rounded shadow-lg z-50 text-white">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 cursor-pointer"
                onClick={() => {
                  navigate(`/shop/product/${s.id}`);
                }}
              >
                <img
                  src={s.cover_image}
                  className="w-10 h-10 object-cover rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm">{s.title}</span>
                  <span className="text-xs text-gray-400">{s.artist}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ActionSearchBar({
  products,
  setFilteredProducts,
}: ActionSearchBarProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      setFilteredProducts(products);
      return;
    }

    const results = products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.artist.toLowerCase().includes(q) ||
        p.genre.toLowerCase().includes(q),
    );

    setFilteredProducts(results);
  }, [query, products, setFilteredProducts]);

  return (
    <div className="w-full 2xl:max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for an album here"
        className="w-full rounded bg-white text-black px-4 py-1 placeholder:font-marcellus"
      />
    </div>
  );
}
