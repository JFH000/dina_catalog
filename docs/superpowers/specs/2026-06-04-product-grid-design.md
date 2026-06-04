# Public Catalog Grid View — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Replace the product table in the public catalog view with a responsive card grid. Each card shows the product image as the dominant element, with a semi-transparent overlay at the bottom containing product info, and quantity controls below the card.

---

## ProductCard Component (`src/components/public/ProductCard.vue`)

Replaces `ProductTableRow.vue` (which is deleted).

### Card anatomy

```
┌─────────────────────┐
│                     │
│    product image    │  ← object-fit: contain, white bg, fixed aspect ratio
│    (dominant)       │
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← rgba(0,0,0,0.55) overlay strip
│ REF-01 · Osterizer  │  ← white text, small, two lines max
│ 13x6.3 · GEMPCO     │
└─────────────────────┘
       [−]  2  [+]       ← quantity controls, below the card
```

- **Props:** `product: Product`
- **Image area:** `aspect-ratio: 1 / 1`, `object-fit: contain`, white background. If no image, show a neutral placeholder (light gray background with a centered "—").
- **Overlay strip:** `position: absolute`, bottom of image, `background: rgba(0,0,0,0.55)`, `padding: 0.4rem 0.6rem`. Contains: `reference` + `name` on line 1 (separated by `·`), `measurements` + `quality` on line 2. All text white, `font-size: 0.72rem`, single line per row with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- **Quantity controls:** below the card container, centered. Same `+`/`−` pattern as before: shows `+` button only when qty = 0; shows `−`, qty number (bold green), `+` when qty > 0.
- Uses `useCartStore` for `addItem`, `removeItem`, `getQuantity`.

---

## CatalogPublicView Changes (`src/views/public/CatalogPublicView.vue`)

- Replace `<table>` + `<ProductTableRow>` with a `<div class="product-grid">` containing `<ProductCard>` per product.
- Filter products: only show `product.is_active === true`.
- Import `ProductCard` instead of `ProductTableRow`.

### Responsive grid

```css
.product-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, 1fr);      /* mobile default */
}

@media (min-width: 480px) {
  .product-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 768px) {
  .product-grid { grid-template-columns: repeat(4, 1fr); }
}
```

---

## Files

| Action | File |
|--------|------|
| Create | `src/components/public/ProductCard.vue` |
| Modify | `src/views/public/CatalogPublicView.vue` |
| Delete | `src/components/public/ProductTableRow.vue` |

---

## Out of Scope

- Sorting or filtering products
- Product detail page on click
- Lightbox/zoom on image
