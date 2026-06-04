# Product Edit & Toggle — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

---

## Overview

Replace the separate product creation page with a modal, add inline editing via the same modal, and replace product deletion with an active/inactive toggle per product.

---

## Database Change

Add `is_active` column to the `products` table:

```sql
alter table public.products add column is_active boolean default true not null;
```

---

## Components

### `ProductModal.vue` (new — replaces `ProductNewView.vue`)

- **Props:** `product?: Product` (null/undefined → create mode; object → edit mode), `catalogId: string`
- **Emits:** `close`, `saved`
- **Fields:** reference, name, measurements, quality, image (optional)
- **Create mode:** blank form, calls `productStore.addProduct()`
- **Edit mode:** form pre-filled with product values; existing image shown as thumbnail with option to replace; calls `productStore.updateProduct()`
- Shown/hidden via `v-if` in `CatalogDetailView`

---

## Store Changes (`src/stores/products.ts`)

Two new methods:

**`updateProduct(id, fields, imageFile?)`**
- Updates reference, name, measurements, quality
- If `imageFile` provided: uploads to Storage and updates `image_url`
- If no `imageFile`: keeps existing `image_url` unchanged
- Updates the matching item in `products.value` reactively

**`toggleProductActive(id, isActive)`**
- Updates `is_active` on the given product
- Updates the matching item in `products.value` reactively

---

## View Changes (`CatalogDetailView.vue`)

- "+ Agregar producto" button opens `ProductModal` with no product prop (create mode)
- Each product row in the table gains two action buttons:
  - **Editar** → opens `ProductModal` with the product (edit mode)
  - **Activo / Inactivo** → calls `productStore.toggleProductActive()` directly
- Inactive products shown with `opacity: 0.45` in the table
- `ProductModal` displayed with `v-if="showModal"`, passing `selectedProduct` (null for create)

---

## Router Change

- Remove route `/catalogs/:id/products/new` from `src/router/index.ts`
- Delete `src/views/owner/ProductNewView.vue`

---

## RLS Policy Change

The existing `products_owner_update` policy already covers UPDATE for the owner, so `updateProduct` and `toggleProductActive` will work without additional policies.

---

## Out of Scope

- Deleting products entirely
- Bulk activate/deactivate
- Product ordering within catalog
