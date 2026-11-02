import RecordTags from "../admin/RecordTags";
import { readRecordTags } from "../admin/recordTagOptions";
import { adminFetch } from "../admin/adminApi";
import { useEffect, useState } from "react";
import type { Product } from "../scripts/picksOfTheWeek";
import { ActionSearchBar } from "../searchBar";
import { Trash } from "lucide-react";

function UpdateProductSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [chosenProduct, setChosenProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Product | null>(null);
  const [message, setMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!editForm) return;

    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    if (!editForm) return;

    try {
      const res = await adminFetch(
        `http://localhost:3001/api/stock/${editForm.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editForm),
        },
      );

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Updated successfully");

        // also update local list instantly
        setProducts((prev) =>
          prev.map((p) => (p.id === editForm.id ? data : p)),
        );

        setChosenProduct(null);
        setEditForm(null);
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Server error");
    }
  };

  const handleDelete = async () => {
    if (!editForm) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this product?",
    );

    if (!confirmDelete) return;

    try {
      const res = await adminFetch(
        `http://localhost:3001/api/stock/${editForm.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (res.ok) {
        setMessage("🗑️ Product deleted");

        // remove from local list instantly
        setProducts((prev) => prev.filter((p) => p.id !== editForm.id));

        setChosenProduct(null);
        setEditForm(null);
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Server error");
    }
  };

  useEffect(() => {
    adminFetch("http://localhost:3001/api/stock?inventory=on-hand")
      .then((res) => res.json())
      .then((data: Product[]) => {
        const sorted = data.sort((a, b) => b.id - a.id); // newest first
        setProducts(sorted);
      })
      .catch((err) =>
        setMessage(
          err instanceof Error ? err.message : "Unable to load records.",
        ),
      );
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center">
        <p className="text-lg font-semibold mb-4">Edit Products</p>
        {!chosenProduct && (
          <ActionSearchBar
            products={products}
            setFilteredProducts={setFilteredProducts}
          />
        )}
        {chosenProduct && (
          <div
            onClick={handleDelete}
            className="cursor-pointer hover:text-red-500 transition text-gray-400"
          >
            <Trash size={16} />
          </div>
        )}
      </div>

      {!chosenProduct && message && (
        <p role="status" className="mb-3 text-sm text-[#c0b4a3]">
          {message}
        </p>
      )}

      {/* LIST VIEW */}
      {!chosenProduct ? (
        <div className="overflow-y-auto flex-1 space-y-1">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => {
                setChosenProduct(product);
                setEditForm({ ...product, tags: readRecordTags(product.tags) });
              }}
              className="bg-black/40 p-1 rounded flex justify-between items-center hover:bg-white/10 cursor-pointer"
            >
              <div className="flex gap-x-2 items-center">
                <img src={product.cover_image} className="w-12" />
                <div className="flex-col">
                  <p className="text-sm">{product.title}</p>
                  <p className="text-xs text-gray-400">{product.artist}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm">{product.medium}</p>
                <p className="text-sm">{product.variant}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* DETAIL VIEW */
        <div className="flex flex-col gap-4 flex-1">
          <button
            onClick={() => {
              setChosenProduct(null);
              setEditForm(null);
            }}
            className="text-xs text-gray-400 hover:text-white w-fit cursor-pointer"
          >
            ← Back
          </button>

          {/* TOP IMAGE */}
          <div className="flex gap-4">
            <img
              src={editForm?.cover_image}
              className="w-32 h-32 object-cover rounded"
            />

            <div className="flex flex-col gap-2 w-full">
              {/* TITLE */}
              <input
                name="title"
                value={editForm?.title || ""}
                onChange={handleChange}
                className="bg-white text-black p-1 text-sm"
                placeholder="Title"
              />

              {/* ARTIST */}
              <input
                name="artist"
                value={editForm?.artist || ""}
                onChange={handleChange}
                className="bg-white text-black p-1 text-sm"
                placeholder="Artist"
              />

              {/* PRICE */}
              <input
                name="price"
                value={editForm?.price || ""}
                onChange={handleChange}
                className="bg-white text-black p-1 text-sm"
                placeholder="Price"
              />
            </div>
          </div>

          {/* COVER IMAGE (FULL WIDTH ON TOP SECTION) */}
          <input
            name="cover_image"
            value={editForm?.cover_image || ""}
            onChange={handleChange}
            className="bg-white text-black p-1 text-sm"
            placeholder="Cover Image URL"
          />

          {/* GRID FIELDS */}
          <div className="grid grid-cols-2 gap-2">
            <input
              name="genre"
              value={editForm?.genre || ""}
              onChange={handleChange}
              className="bg-white text-black p-1 text-sm"
              placeholder="Genre"
            />

            <input
              name="medium"
              value={editForm?.medium || ""}
              onChange={handleChange}
              className="bg-white text-black p-1 text-sm"
              placeholder="Medium"
            />

            <input
              name="variant"
              value={editForm?.variant || ""}
              onChange={handleChange}
              className="bg-white text-black p-1 text-sm"
              placeholder="Variant"
            />

            <input
              name="released"
              value={editForm?.released || ""}
              onChange={handleChange}
              className="bg-white text-black p-1 text-sm"
              placeholder="Released"
            />

            <input
              name="barcode"
              value={editForm?.barcode || ""}
              onChange={handleChange}
              className="bg-white text-black p-1 text-sm"
              placeholder="Barcode"
            />

            <input
              name="stock"
              value={editForm?.stock || ""}
              onChange={handleChange}
              className="bg-white text-black p-1 text-sm"
              placeholder="Stock"
            />
          </div>

          <RecordTags
            value={editForm?.tags}
            onChange={(tags) =>
              setEditForm((current) =>
                current ? { ...current, tags } : current,
              )
            }
          />

          {/* DESCRIPTION */}
          <textarea
            name="description"
            value={editForm?.description || ""}
            onChange={handleChange}
            className="bg-white text-black p-2 text-sm min-h-[120px]"
            placeholder="Description"
          />

          {/* SAVE */}
          <button
            onClick={handleSave}
            className="bg-[#cbb79c] text-black px-4 py-2 rounded hover:opacity-80 cursor-pointer"
          >
            <p>Save Changes</p>
          </button>

          {message && <p className="text-xs text-gray-300 mt-2">{message}</p>}
        </div>
      )}
    </div>
  );
}

export default UpdateProductSection;
