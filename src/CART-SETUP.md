# Kopi’s Records cart

## Install

1. Back up your current `src` folder.
2. Extract this ZIP into your project folder, merging its `src` folder and replacing matching files. The package contains your complete uploaded source, including its original assets.
3. Keep your existing stock backend running and run `npm run dev` as usual.

No new packages or setup scripts are required. The cart page is at `/cart`.

## Using the cart

- Choose a quantity on a product page and press **Add to cart**.
- The header’s Cart link shows the current total quantity. On mobile it is in your existing navigation menu.
- The product page also has a link to the cart beside Quantity once that record is in the cart.
- Edit cart quantities with the buttons or by typing a number and pressing Enter or leaving the field.
- Remove individual records, or choose **Clear cart**.
- Reloading the website restores the selected items. Cart changes also sync across tabs in the same browser.

The existing `kopisrecords-cart` format is retained, so items you already added with the previous product page carry over.

## Prices and stock

The cart reads current product information from your existing `http://localhost:3001/api/stock` endpoint. It refreshes when you enter the cart, return focus to the cart tab, or press **Refresh prices & stock**.

Prices remain fixed in SGD and display with your existing `$` style. Totals use integer cents to avoid rounding errors when adding line totals. Delivery is not included in the cart subtotal.

Sold-out and deleted records remain visible for the customer to remove. If stock falls below a saved quantity, the cart highlights the row and offers a button to adjust to the available quantity. Missing prices leave the subtotal unavailable until the affected record is removed or valid data becomes available.

Cart changes do not modify stock in the database. Checkout, order creation, delivery charges and payment processing can be connected next; this package implements the cart and its product/header connections.

## Source changes

- Added `src/cart/CartProvider.tsx`, `CartContext.ts` and `cartStorage.ts` for shared cart state and persistence.
- Added `src/pages/CartPage.tsx`.
- Connected the provider in `src/main.tsx`, added `/cart` in `src/App.tsx`, and connected the existing header Cart link and count.
- Connected the product page’s existing controls to the shared cart, including quantities already added.
- Removed unused imports from `src/categoriesHeader.tsx` that prevented a strict TypeScript build.

Your homepage, shop page, request page, footer, typography, CSS and assets are unchanged from your uploaded ZIP.

## Validation

Production build and cart integration checks passed using the available React/Vite project configuration. Checks covered product-to-cart navigation, saved carts, quantity entry and limits, totals, removal, clearing, price/stock refresh, missing/sold-out products, API failure/retry, corrupt saved data, storage failures and cross-tab updates.

The new cart files pass ESLint. The uploaded header and product page retain their existing effect-related lint warnings. A visual browser check was not available.
