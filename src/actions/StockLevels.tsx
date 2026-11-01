import { ActionSearchBar } from "../searchBar";
import { useEffect, useState } from "react";
import type { Product } from "../scripts/picksOfTheWeek";

function StockLevelsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [dirty, setDirty] = useState<Record<number, Product>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:3001/api/stock")
      .then(res => res.json())
      .then((data: Product[]) => {
        const sorted = data.sort((a, b) => b.id - a.id);
        setProducts(sorted);
        setFilteredProducts(sorted);
      });
  }, []);

  const handleChange = (id: number, field: keyof Product, value: any) => {
    const original = filteredProducts.find(p => p.id === id);
    if (!original) return;

    const updated = {
      ...(dirty[id] ?? original),
      [field]: value,
    };

    setDirty((prev) => ({
      ...prev,
      [id]: updated,
    }));
  };

  const adjustStock = (id: number, delta: number) => {
    const original = filteredProducts.find(p => p.id === id);
    if (!original) return;

    const current = dirty[id] ?? original;

    const newStock = Math.max(0, Number(current.stock) + delta);

    const updated = {
      ...current,
      stock: newStock,
    };

    setDirty((prev) => ({
      ...prev,
      [id]: updated,
    }));
  };

  const getRow = (p: Product) => dirty[p.id] ?? p;

  const saveAll = async () => {
    const entries = Object.values(dirty);

    await Promise.all(
      entries.map(async (product) => {
        await fetch(`http://localhost:3001/api/stock/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...product,
            stock: Number(product.stock),
          }),
        });
      })
    );

    setDirty({});
    setMessage("✅ All changes saved");
    location.reload();
  };

  return (
    <div className="flex flex-col">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-semibold">Stock Table</p>

        <div className="flex gap-x-2">
          <button
            onClick={saveAll}
            className={`
              bg-green-500 text-black w-40 px-4 rounded text-sm hover:opacity-80 transition
              ${Object.keys(dirty).length > 0
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
              }
            `}
          >
            Save All ({Object.keys(dirty).length})
          </button>

          <ActionSearchBar
            products={products}
            setFilteredProducts={setFilteredProducts}
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-auto border border-white/10 rounded">
        <table className="w-full text-sm">

          <thead className="bg-black/60 sticky top-0">
            <tr className="text-left text-gray-300">
              <th className="p-3">Artist</th>
              <th className="p-3">Title</th>
              <th className="p-3">Medium</th>
              <th className="p-3">Variant</th>
              <th className="p-3 text-right">Stock</th>
            </tr>
          </thead>

          <tbody>
            {filteredProducts.map((p) => {
              const row = getRow(p);
              const isDirty = !!dirty[p.id];

              return (
                <tr
                  key={p.id}
                  className={`border-t border-white/5 transition ${
                    isDirty ? "bg-red-500/30" : "hover:bg-white/5"
                  }`}
                >

                  {/* READ ONLY FIELDS */}
                  <td className="p-2">{row.artist}</td>
                  <td className="p-2">{row.title}</td>
                  <td className="p-2">{row.medium}</td>
                  <td className="p-2">{row.variant}</td>

                  {/* STOCK ONLY EDITABLE */}
                  <td className="p-2">
                    <div className="flex items-center justify-end gap-2">

                      <button
                        onClick={() => adjustStock(p.id, -1)}
                        className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded"
                      >
                        −
                      </button>

                      <input
                        value={row.stock}
                        onChange={(e) =>
                          handleChange(p.id, "stock", e.target.value)
                        }
                        className="bg-white text-black px-2 py-1 w-14 text-center rounded"
                      />

                      <button
                        onClick={() => adjustStock(p.id, +1)}
                        className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded"
                      >
                        +
                      </button>

                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>

        </table>
      </div>

      {message && (
        <p className="text-xs text-gray-300 mt-2">{message}</p>
      )}
    </div>
  );
}

export default StockLevelsSection;