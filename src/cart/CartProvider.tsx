import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Product } from "../scripts/product";
import { CartContext } from "./CartContext";
import {
  CART_KEY,
  completedOrders,
  getPriceCents,
  getStock,
  parseCart,
} from "./cartStorage";
import type { CartItem, CartResult } from "./cartStorage";

const saveMessage =
  "Your browser couldn’t save your cart. It will stay available while this site is open.";

function loadCart() {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const saved = parseCart(raw);
    return {
      items: saved.items,
      completed: completedOrders(raw),
      available: true,
      message: saved.invalid
        ? "Some saved cart items couldn’t be restored. Please check your cart."
        : "",
    };
  } catch {
    return {
      items: [] as CartItem[],
      completed: [] as string[],
      available: false,
      message: saveMessage,
    };
  }
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(loadCart);
  const [items, setItems] = useState(initial.items);
  const [storageMessage, setStorageMessage] = useState(initial.message);
  const itemsRef = useRef(items);
  const storageAvailable = useRef(initial.available);
  const completedRef = useRef<string[]>(initial.completed);
  const completedInMemory = useRef(new Set<string>());

  useEffect(() => {
    function syncCart(event: StorageEvent) {
      if (event.key !== CART_KEY && event.key !== null) return;
      const saved = parseCart(event.newValue);
      completedRef.current = completedOrders(event.newValue);
      if (saved.invalid) {
        setStorageMessage(
          "A saved cart update couldn’t be read. Your current cart is still here.",
        );
        return;
      }
      itemsRef.current = saved.items;
      setItems(saved.items);
      setStorageMessage("");
    }
    window.addEventListener("storage", syncCart);
    return () => window.removeEventListener("storage", syncCart);
  }, []);

  function latestItems(): CartItem[] {
    if (storageAvailable.current) {
      try {
        const raw = window.localStorage.getItem(CART_KEY);
        const saved = parseCart(raw);
        completedRef.current = completedOrders(raw);
        if (!saved.invalid) {
          if (
            JSON.stringify(saved.items) !== JSON.stringify(itemsRef.current)
          ) {
            itemsRef.current = saved.items;
            setItems(saved.items);
          }
          return saved.items;
        }
      } catch {
        storageAvailable.current = false;
        setStorageMessage(saveMessage);
      }
    }
    return itemsRef.current;
  }

  function commit(next: CartItem[]) {
    itemsRef.current = next;
    setItems(next);
    try {
      window.localStorage.setItem(
        CART_KEY,
        JSON.stringify(
          completedRef.current.length
            ? { items: next, completedOrders: completedRef.current }
            : next,
        ),
      );
      storageAvailable.current = true;
      setStorageMessage("");
    } catch {
      storageAvailable.current = false;
      setStorageMessage(saveMessage);
    }
  }

  function addItem(
    product: Pick<Product, "id" | "stock" | "price">,
    quantity: number,
  ): CartResult {
    const id = Number(product.id);
    const stock = getStock(product.stock);
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      return { ok: false, message: "Please choose a valid quantity." };
    }
    if (stock === 0)
      return { ok: false, message: "This record is currently sold out." };
    if (getPriceCents(product.price) === null) {
      return {
        ok: false,
        message: "A price isn’t available for this record right now.",
      };
    }
    const current = latestItems();
    const existing = current.find((item) => item.id === id)?.quantity || 0;
    if (
      !Number.isSafeInteger(existing + quantity) ||
      existing + quantity > stock
    ) {
      return {
        ok: false,
        message: `You already have ${existing} in your cart. Only ${stock} available in total.`,
      };
    }
    const next = existing
      ? current.map((item) =>
          item.id === id ? { ...item, quantity: existing + quantity } : item,
        )
      : [...current, { id, quantity }];
    commit(next);
    return {
      ok: true,
      message: `${quantity} ${quantity === 1 ? "copy" : "copies"} added to your cart.`,
    };
  }

  function updateQuantity(
    id: number,
    quantity: number,
    stock: number,
  ): CartResult {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return {
        ok: false,
        message: "Choose a quantity of at least 1, or remove the record.",
      };
    }
    const available = getStock(stock);
    if (quantity > available) {
      return {
        ok: false,
        message:
          available > 0
            ? `Only ${available} available. Choose a lower quantity.`
            : "This record is currently sold out.",
      };
    }
    const current = latestItems();
    if (!current.some((item) => item.id === id)) {
      return { ok: false, message: "This record is no longer in your cart." };
    }
    commit(
      current.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
    return { ok: true, message: "Quantity updated." };
  }

  function removeItem(id: number) {
    commit(latestItems().filter((item) => item.id !== id));
  }

  function completeOrder(orderId: string, orderedItems: CartItem[]) {
    const current = latestItems();
    if (
      completedInMemory.current.has(orderId) ||
      completedRef.current.includes(orderId)
    )
      return;
    const purchased = new Map(
      orderedItems.map((item) => [item.id, item.quantity]),
    );
    const next = current.flatMap((item) => {
      const quantity = Math.max(
        0,
        item.quantity - (purchased.get(item.id) || 0),
      );
      return quantity ? [{ ...item, quantity }] : [];
    });
    completedInMemory.current.add(orderId);
    completedRef.current = [...completedRef.current, orderId].slice(-100);
    commit(next);
  }

  function clearCart() {
    commit([]);
  }

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount: items.reduce((total, item) => total + item.quantity, 0),
        storageMessage,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        completeOrder,
        quantityFor: (id) =>
          itemsRef.current.find((item) => item.id === Number(id))?.quantity ||
          0,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
