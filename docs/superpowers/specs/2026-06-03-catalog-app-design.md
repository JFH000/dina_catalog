# Dina Catalog — Design Spec

**Date:** 2026-06-03  
**Status:** Approved

---

## Overview

A web catalog application where a business owner can create product catalogs, share them via link with customers, and receive orders through WhatsApp.

---

## Stack

- **Frontend:** Vue 3 + TypeScript + Vite (existing project)
- **Routing:** Vue Router
- **State:** Pinia
- **Backend:** Supabase (Auth, PostgreSQL, Storage)

---

## Architecture

### Two zones

| Zone | Route | Access |
|------|-------|--------|
| Owner dashboard | `/login`, `/dashboard`, `/catalogs/*` | Authenticated only |
| Public catalog view | `/c/:slug` | Anyone with the link |

### Flow

1. Owner signs up / logs in → creates catalogs → adds products → generates link → shares via WhatsApp.
2. Customer opens link → browses products → builds order → optionally fills in contact info → sends WhatsApp summary.

---

## Database Schema

### `profiles`
Extends Supabase Auth users.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK → auth.users |
| full_name | text | |
| whatsapp_number | text | Default number for catalogs |

### `catalogs`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| owner_id | uuid | FK → profiles |
| name | text | |
| slug | text | Unique, auto-generated from name + random suffix |
| whatsapp_number | text | Nullable — overrides owner's default |
| is_active | boolean | Controls whether public link works |
| created_at | timestamptz | |

### `products`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| catalog_id | uuid | FK → catalogs |
| reference | text | |
| name | text | |
| measurements | text | |
| quality | text | |
| image_url | text | Nullable — stored in Supabase Storage |
| created_at | timestamptz | |

### `orders`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| catalog_id | uuid | FK → catalogs |
| customer_name | text | Nullable |
| customer_email | text | Nullable |
| customer_phone | text | Nullable |
| items | jsonb | Array of `{ product_id, quantity }` |
| created_at | timestamptz | |

### Row Level Security

| Table | Rule |
|-------|------|
| `profiles` | User can read/update their own row |
| `catalogs` | Owner can CRUD their own; anyone can SELECT active catalogs (for public view) |
| `products` | Owner can CRUD their own; anyone can SELECT products of active catalogs |
| `orders` | Anyone (anon) can INSERT; only catalog owner can SELECT |

---

## Owner Dashboard

### Pages

| Page | Description |
|------|-------------|
| `/login` | Email + password login / signup via Supabase Auth |
| `/dashboard` | List of all catalogs with active/inactive toggle and link copy button |
| `/catalogs/new` | Form: catalog name, optional WhatsApp override |
| `/catalogs/:id` | Catalog detail: product list, generated link, active toggle, add product button |
| `/catalogs/:id/products/new` | Form: reference, name, measurements, quality, optional image upload |

### Slug generation

Auto-generated from catalog name: `"Colección Verano 2025"` → `coleccion-verano-2025-a3f2` (lowercase, no accents, random 4-char suffix). Used to build the public URL: `https://domain.com/c/coleccion-verano-2025-a3f2`.

---

## Public Catalog View (`/c/:slug`)

### States

- **Inactive catalog:** Shows "Este catálogo ya no está disponible."
- **Active catalog:** Shows catalog name and product table.

### Product table columns

Image thumbnail | Reference | Name | Measurements | Quality | `+` button

### Quantity interaction

- Clicking `+` on a product adds it to the order and shows a large quantity counter next to that product row (with `+` and `−` buttons).
- A floating button (bottom-right) shows the total item count and opens the order summary.

### Order summary panel / modal

- List of selected products with quantities.
- Optional fields: customer name, email, phone.
- "Enviar por WhatsApp" button.

### WhatsApp send flow

1. Save order to `orders` table in Supabase (using anon key).
2. Build message text:
   ```
   Hola! Mi pedido del catálogo [Nombre]:
   - [REF001] Producto A x2
   - [REF002] Producto B x1

   Nombre: Juan (if provided)
   Tel: 123456789 (if provided)
   ```
3. Open `https://wa.me/[whatsapp_number]?text=[encoded_message]` in a new tab.

The WhatsApp number used is: catalog's `whatsapp_number` if set, otherwise the owner's `profiles.whatsapp_number`.

---

## Error Handling

- Invalid/inactive slug → friendly message page.
- Image upload failure → allow saving product without image, show error toast.
- Supabase order insert failure → show error, do not open WhatsApp (avoid lost orders).
- Auth errors → redirect to `/login`.

---

## Out of Scope (for now)

- Pricing / price negotiation
- Owner notifications (email/push) on new orders
- Customer authentication
- Catalog expiration dates
- Product sorting / ordering within catalog
