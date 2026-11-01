import "../App.css";
import bg2 from "../assets/backgrounds/second-slide-bg.png";
import NavBar from "../navbar";
import { useEffect, useState } from "react";
import MobileNavBar from "../mobileNavbar";
import Footer from "../footer";
import { DesktopCategories, MobileCategories } from "../categoriesHeader";
import SearchBar from "../searchBar";
import { useParams } from "react-router-dom";
import { Divider } from "@mui/material";
import { Check } from "lucide-react";
import type { Product } from "../scripts/picksOfTheWeek";

function ProductPage() {
  const { id } = useParams();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [, setActiveQuery] = useState("");

  useEffect(() => {
    fetch("http://localhost:3001/api/stock")
      .then((res) => res.json())
      .then((data: Product[]) => {
        setAllProducts(data);
        const found = data.find((p) => p.id === Number(id));
        setProduct(found || null);
      });
  }, [id]);

  return (
    <div className="bg-black">
      <MobileNavBar />
      <NavBar />
      <section
        className="text-white"
        style={{ backgroundImage: `url(${bg2})` }}
      >
        {/* SHOW MOBILE HERE */}
        <div className="2xl:hidden">
          <MobileCategories />
          <div className="px-5 mt-3">
            <SearchBar
              products={allProducts}
              setActiveQuery={setActiveQuery}
              setFilteredProducts={setAllProducts}
            />
          </div>
        </div>
        {/* SHOW CATEGORIES AND SEARCH BAR FOR DESKTOP */}
        <div className="hidden 2xl:flex flex-col bg-black/20 backdrop-blur-md text-white w-full items-center">
          <DesktopCategories />
          <SearchBar
            products={allProducts}
            setActiveQuery={setActiveQuery}
            setFilteredProducts={setAllProducts}
          />
        </div>

        {/* PRODUCT SECTION */}
        <section className="flex flex-col flex-1 2xl:flex-row 2xl:p-16 text-white items-center">
          {/* LEFT — COVER */}
          <div className="w-full 2xl:w-1/4 flex justify-center 2xl:bg-black/40 2xl:backdrop-blur-md p-2">
            <img
              src={product?.cover_image}
              alt={product?.title}
              className="w-auto h-auto object-contain"
            />
          </div>
          {/* MIDDLE — INFO */}
          <div className="w-full 2xl:w-1/2 flex flex-col 2xl:gap-3 p-6">
            <p className="text-xl 2xl:text-4xl font-semibold">
              {product?.title}
            </p>
            <p className="text-base 2xl:text-xl">{product?.artist}</p>
            <p className="mt-4 mb-2 2xl:text-base text-sm">
              {product?.description}
            </p>
            <Divider sx={{ borderColor: "rgb(48, 47, 47)" }} />
            <div className="mt-2 text-sm 2xl:text-base">
              <p>
                <strong>Format:</strong> {product?.medium}
              </p>
              <p>
                <strong>Variant:</strong> {product?.variant}
              </p>
              <p>
                <strong>Released:</strong> {product?.released}
              </p>
              <p>
                <strong>Barcode:</strong> {product?.barcode}
              </p>
            </div>
            <p className="2xl:text-base text-sm">
              <strong>Genre:</strong> {product?.genre}
            </p>
          </div>
          {/* RIGHT — ACTIONS */}
          <div className="w-full 2xl:w-1/4 flex flex-col gap-2">
            <div className="bg-black/40 backdrop-blur-md">
              <div className="justify-between flex bg-black/60 p-4">
                <p className="2xl:text-2xl">Price</p>
                <p className="2xl:text-2xl">${product?.price}</p>
              </div>
              <div className="p-4">
                <div className="justify-between flex text-base">
                  <p>Stock: {product?.stock}</p>
                  <p>
                    <strong>Limited Stock Left</strong>
                  </p>
                </div>
                <button
                  disabled={product?.stock === 0}
                  className={`
                    mt-2 px-3 py-1 w-full rounded text-black transition
                    ${
                      product?.stock === 0
                        ? "bg-gray-400 cursor-not-allowed opacity-50"
                        : "bg-[#cbb79c] hover:opacity-80"
                    }
                  `}
                >
                  {product?.stock === 0 ? "Sold Out" : "Add to Cart"}
                </button>
                <div className="text-xs text-gray-400 mt-2">
                  <p>Free local mailing on orders over $100</p>
                  <p>Get your records within 2–3 working days</p>
                  <div className="gap-2 flex items-center">
                    <Check size={14} />
                    <p>7 Day Return Policy</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-black/40 backdrop-blur-md">
              <div className="p-4 bg-black/60">
                <p className="2xl:text-lg">More Like This</p>
              </div>
              <div className="grid grid-cols-4 p-4">
                {allProducts
                  .filter(
                    (p) => p.genre === product?.genre && p.id !== product?.id,
                  )
                  .slice(0, 4)
                  .map((item) => (
                    <a
                      key={item.id}
                      href={`/shop/product/${item.id}`}
                      className="flex flex-col items-center text-center hover:scale-110 transition"
                    >
                      <img
                        src={item.cover_image}
                        alt={item.title}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <p className="text-xs mt-2 line-clamp-2">{item.title}</p>
                    </a>
                  ))}
              </div>
            </div>
          </div>
        </section>
      </section>
      <Footer />
    </div>
  );
}

export default ProductPage;
