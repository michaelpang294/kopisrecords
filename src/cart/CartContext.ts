import { createContext, useContext } from "react";
import type { Product } from "../scripts/picksOfTheWeek";
import type { CartItem, CartResult } from "./cartStorage";

export type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  storageMessage: string;
  addItem: (
    product: Pick<Product, "id" | "stock" | "price">,
    quantity: number,
  ) => CartResult;
  updateQuantity: (id: number, quantity: number, stock: number) => CartResult;
  removeItem: (id: number) => void;
  clearCart: () => void;
  completeOrder: (orderId: string, orderedItems: CartItem[]) => void;
  quantityFor: (id: number) => number;
};

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
}
