export type Product = {
  id: number;
  title: string;
  artist: string;
  price: number;
  genre: string;
  cover_image: string;
  medium: string;
  description: string;
  released: string;
  barcode: string;
  stock: number;
  variant: string;
  tags?: string[] | string | null;
};

export const shopCategories = [
  { name: "New Releases", link: "/shop/new-releases" },
  { name: "New Arrivals", link: "/shop/new-arrivals" },
  { name: "Top Sellers", link: "/shop/top-sellers" },
  { name: "Vinyl Records", link: "/shop/vinyl-records" },
  { name: "CDs", link: "/shop/cds" },
  { name: "Closeout Crate", link: "/shop/closeout-crate" },
  { name: "Shop All", link: "/shop" },
];

export const informationCategories = [
  { name: "FAQ", link: "/faq" },
  { name: "Local Gigs", link: "/local-gigs" },
  { name: "Admin", link: "/admin" },
];

export const actionCategories = [
  {
    name: "➕ Create New Listing",
    link: "/admin/create",
  },
  {
    name: "✏️ Edit Existing Products",
    link: "/admin/edit",
  },
  {
    name: "📦 Manage Stock Levels",
    link: "/admin/stock",
  },
  {
    name: "🔐 Log Out",
    link: "/admin",
  },
];
