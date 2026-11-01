import album1 from '../assets/products/fela kuti.jpg'
import album2 from '../assets/products/sprain.jpg'
import album3 from '../assets/products/the-strokes.jpg';

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
]

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
    link: "/admin"
  }
];

export const picks = [
  {
    title: "The New Abnormal",
    artist: "The Strokes",
    image: album1,
    description: "A slick, melancholic comeback record with razor-sharp songwriting."
  },
  {
    title: "The Lamb as Effigy",
    artist: "Sprain",
    image: album2,
    description: "Lo-fi, fuzzy, and full of character."
  },
  {
    title: "Zombie",
    artist: "Fela Kuti",
    image: album3,
    description: "A powerful blend of Afrobeat and funk."
  },
  {
    title: "The New Abnormal",
    artist: "The Strokes",
    image: album1,
    description: "A slick, melancholic comeback record with razor-sharp songwriting."
  },
  {
    title: "The Lamb as Effigy",
    artist: "Sprain",
    image: album2,
    description: "Lo-fi, fuzzy, and full of character."
  },
  {
    title: "Zombie",
    artist: "Fela Kuti",
    image: album3,
    description: "A powerful blend of Afrobeat and funk."
  },
   {
    title: "The Lamb as Effigy",
    artist: "Sprain",
    image: album2,
    description: "Lo-fi, fuzzy, and full of character."
  },
  {
    title: "Zombie",
    artist: "Fela Kuti",
    image: album3,
    description: "A powerful blend of Afrobeat and funk."
  }
];