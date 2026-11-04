import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import StoreHeader from "./components/StoreHeader";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import FAQPage from "./pages/FAQPage";
import ContactPage from "./pages/ContactPage";
import BlogPage from "./pages/BlogPage";
import BlogArticlePage from "./pages/BlogArticlePage";
import ProductPage from "./pages/ProductPage";
import RequestRecordPage from "./pages/RequestPage";
import AdminPage from "./pages/AdminPage";
import CartPage from "./pages/CartPage";

import CheckoutPage from "./pages/CheckoutPage";
import OrderPage from "./pages/OrderPage";
import StockAlertPage from "./pages/StockAlertPage";
import { discardLegacyOrderHistory } from "./orders/orderRecovery";

export default function App() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    discardLegacyOrderHistory();
  }, []);

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

        <Route path="/faq" element={<FAQPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogArticlePage />} />
        <Route path="/request" element={<RequestRecordPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/stock-alert" element={<StockAlertPage />} />
        <Route path="/orders" element={<Navigate to="/shop" replace />} />

        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:action" element={<AdminPage />} />
      </Routes>
    </div>
  );
}
