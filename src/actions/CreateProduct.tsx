import RecordTags from "../admin/RecordTags";
import { adminFetch } from "../admin/adminApi";
import { useState } from "react";

function CreateProductSection() {
  const [form, setForm] = useState({
    title: "",
    artist: "",
    price: "",
    genre: "",
    cover_image: "",
    description: "",
    medium: "Vinyl",
    variant: "",
    released: "",
    barcode: "",
    stock: "1",
    tags: ["new_arrival"] as string[],
  });

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChange = (e: React.ChangeEvent<any>) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await adminFetch("http://localhost:3001/api/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Product created");
        setForm({
          title: "",
          artist: "",
          price: "",
          genre: "",
          cover_image: "",
          description: "",
          medium: "Vinyl",
          variant: "",
          released: "",
          barcode: "",
          stock: "1",
          tags: ["new_arrival"] as string[],
        });
      } else {
        setMessage("❌ " + data.error);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error creating product");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "p-2 rounded bg-white text-black placeholder:text-gray-500 text-sm focus:outline-none";

  return (
    <div className="flex flex-col h-full">
      <p className="text-lg font-semibold mb-4">Create New Listing</p>

      {/* FORM */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* BASIC INFO */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Basic Info</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Title"
              className={`${inputClass} col-span-2`}
            />
            <input
              name="artist"
              value={form.artist}
              onChange={handleChange}
              placeholder="Artist"
              className={inputClass}
            />
            <input
              name="genre"
              value={form.genre}
              onChange={handleChange}
              placeholder="Genre"
              className={inputClass}
            />
          </div>
        </div>

        {/* PRICING & STOCK */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Pricing & Stock</p>
          <div className="grid grid-cols-3 gap-3">
            <input
              name="price"
              value={form.price}
              onChange={handleChange}
              placeholder="Price"
              className={inputClass}
            />
            <input
              name="stock"
              value={form.stock}
              onChange={handleChange}
              placeholder="Stock"
              className={inputClass}
            />
            <input
              name="barcode"
              value={form.barcode}
              onChange={handleChange}
              placeholder="Barcode"
              className={inputClass}
            />
          </div>
        </div>

        {/* PRODUCT DETAILS */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Details</p>
          <div className="grid grid-cols-3 gap-3">
            <select
              name="medium"
              value={form.medium}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="Vinyl">Vinyl</option>
              <option value="CD">CD</option>
            </select>
            <input
              name="variant"
              value={form.variant}
              onChange={handleChange}
              placeholder="Variant"
              className={inputClass}
            />
            <input
              name="released"
              value={form.released}
              onChange={handleChange}
              placeholder="Year"
              className={inputClass}
            />
          </div>
        </div>

        <RecordTags
          value={form.tags}
          newListing
          onChange={(tags) => setForm((current) => ({ ...current, tags }))}
        />

        {/* IMAGE */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Cover</p>
          <input
            name="cover_image"
            value={form.cover_image}
            onChange={handleChange}
            placeholder="Image URL"
            className={`${inputClass} w-full`}
          />
        </div>

        {/* DESCRIPTION */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Description</p>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Optional description..."
            className={`${inputClass} w-full`}
          />
        </div>
      </div>

      {/* SUBMIT */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="bg-[#cbb79c] text-black px-4 py-2 rounded hover:opacity-80"
        >
          <p>{busy ? "Creating…" : "Create"}</p>
        </button>

        {message && <p className="text-sm text-gray-300">{message}</p>}
      </div>
    </div>
  );
}

export default CreateProductSection;
