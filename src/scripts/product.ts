export type Product = {
  id: number;
  title: string;
  artist: string;
  price: number;
  genre: string;
  cover_image: string;
  images?: string[] | string | null;
  medium: string;
  description: string;
  released: string;
  barcode: string;
  stock: number;
  variant: string;
  preorderStatus?: string;
  expectedArrival?: string | null;
  tags?: string[] | string | null;
};
