# WhatsApp Order → Odoo Draft Invoice — Design Spec

**Date:** 2026-08-01
**Status:** Approved

---

## Overview

Extend the existing WhatsApp order flow (order already gets inserted into `orders` on send) so that:

1. The WhatsApp message includes a link to a protected admin order page.
2. The admin can Accept or Reject the order from that page (or from a new "Pedidos" section per catalog).
3. Accepting an order creates a **draft** invoice (`account.move`, `move_type='out_invoice'`, left unposted) in the connected Odoo instance (`fstest1.odoo.com`) via a new Supabase Edge Function, and stores a link back to it.
4. Rejecting an order just marks it rejected — no Odoo interaction.

Explicitly out of scope for this iteration: factura rectificativa / correction flow (that only applies to an already-posted invoice — none are posted here), automatic Odoo contact matching/creation (uses one configured default customer), automatic WhatsApp notification back to the customer, and any UI inside Odoo itself.

---

## Architecture

```
Customer (WhatsApp) → OrderModal.vue → INSERT orders (Supabase) → order link in WA message
                                                                          │
Admin opens link (auth required) → OrderDetailView.vue → "Aceptar"
                                                                          │
                                              supabase.functions.invoke('accept-order')
                                                                          │
                                    Edge Function (Deno) ── HTTP JSON-RPC ──▶ Odoo /mcp
                                              │                              (search product by SKU,
                                              │                               create draft account.move)
                                              ▼
                                    UPDATE orders (status, odoo_invoice_id)
```

The Edge Function talks to Odoo over the same native `/mcp` Streamable HTTP endpoint already validated during setup (Bearer auth with the "MCP"-scoped API key), calling it as a plain HTTP JSON-RPC client — not through Claude. This was chosen over the classic XML-RPC/JSON-2 external API because that path already failed authentication against this specific Odoo SaaS trial instance, while `/mcp` is confirmed working.

**Verification needed during implementation:** the tool name for creating records isn't known yet — today the Odoo MCP connection only exposes read tools (`ai_tool_search`, `ai_tool_get_fields`, `ai_tool_get_models`, `ai_tool_read_group`, `ai_tool_mcp_retrieve_initial_context`). Before building the Edge Function, enable write/create permissions for `account.move`, `account.move.line`, and read for `product.product` in Odoo → Settings → MCP Server (for the user tied to the MCP API key), then re-inspect the available tools.

---

## Data Model

### Migration: `orders` table

```sql
alter table orders
  add column status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  add column odoo_invoice_id integer,
  add column accepted_at timestamptz,
  add column rejected_at timestamptz;
```

### `src/types/index.ts` — `Order` interface

Currently missing fields needed to link/update individual orders. Add:

```typescript
export interface Order {
  id: string
  catalog_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  items: OrderItem[]
  status: 'pending' | 'accepted' | 'rejected'
  odoo_invoice_id: number | null
  created_at: string
  accepted_at: string | null
  rejected_at: string | null
}
```

### RLS policies (new)

No policy today lets a catalog owner read or update `orders` (only the public `INSERT` from `OrderModal` exists). Add:

- `SELECT` on `orders` where `catalog_id` belongs to a catalog owned by `auth.uid()`.
- `UPDATE` on `orders` (same ownership condition) — used directly by the Reject flow and by the Edge Function's atomic "claim" step.

### Supabase Edge Function secrets

`ODOO_URL`, `ODOO_MCP_API_KEY`, `ODOO_DEFAULT_PARTNER_ID` (the fixed Odoo customer used on every generated invoice; the admin edits the real customer later inside Odoo).

---

## Flows

### 1. Customer sends an order (existing flow, minor changes)

- `OrderModal.vue`: change the `orders` insert to `.select().single()` so the new row's `id` is available.
- `src/lib/whatsapp.ts` — `buildWhatsAppMessage()` gains an optional 4th parameter `orderLink?: string`; when present, appends a line `Ver pedido: {orderLink}`. Backward compatible — existing calls/tests without the param are unaffected.
- `orderLink = \`${window.location.origin}/orders/${order.id}\``.

### 2. Admin views orders

- New route `/orders/:id` (`meta: { requiresAuth: true }`) → `OrderDetailView.vue`: catalog name, customer info (only populated fields shown), item list with quantities, status badge, and **Aceptar**/**Rechazar** buttons (only rendered when `status === 'pending'`).
- `CatalogDetailView.vue` gains a **"Pedidos"** section (alongside the existing product grid) listing that catalog's orders — customer name (or a placeholder), date, item count, status badge — each row links to `/orders/:id`.
- New store `src/stores/orders.ts` — `fetchByCatalog(catalogId)`, `fetchById(id)`, `accept(id)`, `reject(id)`, following the same Pinia pattern as `products.ts`.

### 3. Reject

Direct frontend update, no Odoo call:

```sql
update orders set status='rejected', rejected_at=now() where id = :id
```

Button disabled while the request is in flight; hidden once `status !== 'pending'`.

### 4. Accept → create Odoo draft invoice

Edge Function `accept-order`, invoked as `supabase.functions.invoke('accept-order', { body: { orderId } })`:

1. Verify the caller (via their JWT) owns the catalog the order belongs to.
2. **Atomically claim the order**: `UPDATE orders SET status='accepted' WHERE id = :id AND status = 'pending'`. If zero rows affected, return an error ("este pedido ya fue gestionado") — prevents duplicate invoices from a double click or retry race.
3. For each order item, resolve an Odoo invoice line:
   - Search `product.product` where `default_code = <dina_catalog product.reference>` (fields: `id`, `name`, `list_price`).
   - Match found → line references that Odoo product (price comes from Odoo).
   - No match → text-only line: `[{reference}] {name} (no encontrado en Odoo)`, quantity, `price_unit: 0`.
4. Create `account.move` with `move_type: 'out_invoice'`, `partner_id: ODOO_DEFAULT_PARTNER_ID`, and the resolved `invoice_line_ids`. Do **not** call any post/validate action — Odoo leaves newly created moves in `draft` state, which is exactly the "borrador" requested.
5. On success: `UPDATE orders SET odoo_invoice_id = :id, accepted_at = now()`.
6. On any failure (Odoo unreachable, permission error, etc.): revert `status` back to `'pending'` and return the error — an order is never left `accepted` without a real invoice behind it.

### 5. Viewing the invoice

Once `odoo_invoice_id` is set, both `OrderDetailView` and the order's row under "Pedidos" show a **"Ver factura en Odoo ↗"** link opening:

```
{ODOO_URL}/web#id={odoo_invoice_id}&model=account.move&view_type=form
```

in a new tab (the classic hash-based Odoo backend URL, retained for backward compatibility across Odoo versions including 19).

---

## Error Handling

| Situation | Result |
|---|---|
| Order already accepted/rejected when "Aceptar" is clicked (race) | Atomic claim update affects 0 rows → error shown, no invoice created |
| Odoo `/mcp` unreachable or auth fails | Order reverted to `pending`, error message shown, admin can retry |
| Write permission not yet enabled in Odoo for `account.move` | Same as above — surfaced as a clear error, not a silent failure |
| Order item's product has no match in Odoo (`default_code`) | Not an error — text-only line with price 0, invoice still created |
| Admin without ownership of the catalog opens `/orders/:id` | Order not found / access denied state shown |
| Reject request fails (network) | Error shown, order stays `pending`, button re-enabled |

---

## Testing

- Unit tests (Vitest, matching existing `__tests__` convention):
  - `whatsapp.test.ts` — extend for the new `orderLink` parameter (message includes/excludes the line correctly).
  - `orders` store — `accept`/`reject` happy paths and the "already handled" race error, with `supabase.functions.invoke` and the DB calls mocked.
- The Edge Function's Odoo integration (product matching, invoice creation) is verified manually against the `fstest1.odoo.com` sandbox during implementation — no live-Odoo dependency in the automated test suite.

---

## Out of Scope

- Factura rectificativa / invoice correction flow.
- Automatic Odoo contact (`res.partner`) search or creation — uses one fixed default customer.
- Posting/validating the invoice in Odoo (stays draft).
- Notifying the customer of accept/reject via WhatsApp.
- Multi-catalog aggregated "Pedidos" view (orders live under each catalog only).
- Handling more than one Odoo company/journal — assumes the default journal Odoo picks for `out_invoice`.
