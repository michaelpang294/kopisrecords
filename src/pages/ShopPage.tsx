import '../App.css';
import bg2 from '../assets/backgrounds/second-slide-bg.png';
import NavBar from '../navbar';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, SlidersHorizontal } from "lucide-react";
import MobileNavBar from '../mobileNavbar';
import Divider from '@mui/material/Divider';
import Footer from '../footer';
import { useNavigate } from "react-router-dom";
import { DesktopCategories, MobileCategories } from '../categoriesHeader';
import SearchBar from '../searchBar';
import type { Product } from '../scripts/picksOfTheWeek';

function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeQuery, setActiveQuery] = useState("");

  // PAGINATION CONTROL
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const nextPage = () => {
    setCurrentPage((p) => Math.min(p + 1, totalPages));
  };

  const prevPage = () => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  };

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:3001/api/stock")
      .then(res => res.json())
      .then((data: Product[]) => {
        setProducts(data);
        setFilteredProducts(data);
      });
  }, []);

  return (
    <div className='bg-black'>
      <MobileNavBar />
      <NavBar />

      <section
        className="2xl:min-h-[calc(100vh-80px)] min-h-[calc(100vh-48px)] flex flex-col text-white"
        style={{ backgroundImage: `url(${bg2})` }}
      >

        {/* MOBILE */}
        <div className='2xl:hidden'>
          <MobileCategories />
          <div className='px-5 mt-3'>
            <SearchBar
              products={products}
              setActiveQuery={setActiveQuery}
              setFilteredProducts={setFilteredProducts}
            />
          </div>
        </div>

        {/* DESKTOP */}
        <div className='hidden 2xl:flex flex-col bg-black/20 backdrop-blur-md text-white w-full items-center'>
          <DesktopCategories />
          <SearchBar
            products={products}
            setActiveQuery={setActiveQuery}
            setFilteredProducts={setFilteredProducts}
          />
        </div>

        {/* MAIN SECTION */}
        <section className='2xl:px-8 2xl:py-4 px-5 flex flex-col flex-1 min-h-full'>

          <div className="flex flex-col flex-1">

            {/* TOP BAR */}
            <div>
              <div className='w-full flex justify-between text-sm items-center 2xl:mb-3 mb-1'>
                <a className='bg-[#cbb79c] px-2 py-1 text-black rounded-sm hover:opacity-90 transition text-center hover:cursor-pointer'>
                  <div className='flex items-center gap-1 text-xs 2xl:text-base'>
                    <SlidersHorizontal size={14} />
                    <p>Filters</p>
                  </div>
                </a>

                <p className='text-xs 2xl:text-base'>
                  Search Results for{" "}
                  <strong>
                    {activeQuery ? `"${activeQuery}"` : " All Products"}
                  </strong>
                </p>

                <div className='flex items-center gap-x-2'>
                  <p className='text-xs 2xl:text-base'>
                    Page {currentPage} of {totalPages}
                  </p>
                  <ArrowLeft size={14} onClick={prevPage} className="cursor-pointer" />
                  <ArrowRight size={14} onClick={nextPage} className="cursor-pointer" />
                </div>
              </div>

              <Divider sx={{ borderColor: "rgb(48, 47, 47)" }} />
            </div>

            {/* PRODUCTS GRID */}
            <div className='mt-3 grid 2xl:grid-cols-8 grid-cols-4 2xl:gap-2 gap-1'>
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  className="2xl:p-4 p-2 rounded bg-black/70 flex flex-col h-full hover:cursor-pointer"
                  onClick={() => navigate(`/shop/product/${product.id}`)}
                >
                  <img
                    src={product.cover_image}
                    alt={product.title}
                    className="w-full h-auto mb-2"
                  />
                  <p className='text-xs 2xl:text-base'>{product.title}</p>
                  <p className='text-xs 2xl:text-sm'>{product.artist}</p>
                  <p className='text-xs 2xl:text-sm mt-auto'>${product.price}</p>
                </div>
              ))}
            </div>

            {/* BOTTOM PAGINATION (STICKS TO BOTTOM) */}
            {totalPages > 1 && (
              <div className='mt-auto flex items-center justify-end gap-x-2 pt-4'>
                <p className='text-xs 2xl:text-base'>
                  Page {currentPage} of {totalPages}
                </p>
                <ArrowLeft
                  size={14}
                  className="cursor-pointer"
                  onClick={prevPage}
                />
                <ArrowRight
                  size={14}
                  className="cursor-pointer"
                  onClick={nextPage}
                />
              </div>
            )}

          </div>
        </section>
      </section>

      <Footer />
    </div>
  );
}

export default ShopPage;