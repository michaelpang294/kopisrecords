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
