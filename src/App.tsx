import { Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import StoreHeader from "./components/StoreHeader";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductPage from "./pages/ProductPage";
import RequestRecordPage from "./pages/RequestPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.history.scrollRestoration = "manual";

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname]);
    
  return (
    <div className="min-h-screen bg-[#15120f] text-[#efe8dc]">
      <StoreHeader />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/search/:query" element={<ShopPage />} />
        <Route path="/shop/product/:id" element={<ProductPage />} />

        <Route path="/request" element={<RequestRecordPage />} />

        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:action" element={<AdminPage />} />
      </Routes>
    </div>
  );
}