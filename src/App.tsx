import { Routes, Route } from "react-router-dom";
import Home from "../src/pages/HomePage";
import ShopPage from "../src/pages/ShopPage";
import ProductPage from "./pages/ProductPage";
import AdminPage from "./pages/AdminPage";
import RequestRecordPage from "./pages/RequestPage";

// Inside your existing <Routes>:

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/shop/search/:query" element={<ShopPage />} />
      <Route path="/shop/product/:id" element={<ProductPage />} />
      <Route path="/request" element={<RequestRecordPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/:action" element={<AdminPage />} />
    </Routes>
  );
}