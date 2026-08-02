# WhatsApp Order → Odoo Draft Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an admin accepts a WhatsApp-submitted order, dina_catalog automatically creates a draft invoice in Odoo and surfaces a link back to it; admins can also reject orders, and every order gets a shareable admin-only detail page linked from the WhatsApp message.

**Architecture:** Order status (`pending`/`accepted`/`rejected`) and `odoo_invoice_id` are added to the existing `orders` table. A new Pinia store (`orders.ts`) and two view changes (`OrderDetailView.vue` new, `CatalogDetailView.vue` extended) handle the admin UI. Accepting an order calls a new Supabase Edge Function (`accept-order`) which authenticates the caller, atomically claims the order, matches line items to Odoo products by SKU, and creates a draft `account.move` in Odoo over the already-connected native `/mcp` HTTP endpoint (not the classic XML-RPC API, which is blocked on this Odoo instance).

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Pinia, Vue Router, Supabase (Postgres + Auth + Edge Functions/Deno), Vitest + @vue/test-utils, Odoo 19 native MCP server (Streamable HTTP, JSON-RPC 2.0).

## Global Constraints

- No semicolons, single quotes, 2-space indent — matches every existing file in `src/`.
- New Pinia stores follow the `defineStore('name', () => { ... return {...} })` composition pattern used in `cart.ts` / `products.ts` / `catalog.ts` — no options-API stores.
- New Vitest tests live under `__tests__/` next to the code they test, using `describe`/`it`/`expect` from `vitest` (see `src/lib/__tests__/whatsapp.test.ts`, `src/stores/__tests__/cart.test.ts`).
- Never post/validate the Odoo invoice — it must stay in Odoo's `draft` state ("borrador").
- An order must never end up with `status='accepted'` unless `odoo_invoice_id` was actually set — any Odoo failure reverts status to `'pending'`.
- Odoo connection details already live in `.env.local` for local dev reference (`ODOO_MCP_API_KEY`) but the Edge Function reads its own copies from Supabase secrets (`ODOO_URL`, `ODOO_MCP_API_KEY`, `ODOO_DEFAULT_PARTNER_ID`) — these are server-side only, never bundled into the Vite client build.

---

### Task 1: Database migration — order status, invoice link, RLS

**Files:**
- Create: `supabase/migrations/20260801000000_orders_status_invoice.sql`

**Interfaces:**
- Produces: `orders.status` (`text`, one of `'pending' | 'accepted' | 'rejected'`, default `'pending'`), `orders.odoo_invoice_id` (`integer`, nullable), `orders.accepted_at` / `orders.rejected_at` (`timestamptz`, nullable). New RLS policies allowing a catalog owner to `SELECT`/`UPDATE` their own catalogs' orders.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260801000000_orders_status_invoice.sql
alter table orders
  add column status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  add column odoo_invoice_id integer,
  add column accepted_at timestamptz,
  add column rejected_at timestamptz;

create policy "Owners can view their catalogs' orders"
  on orders for select
  using (
    catalog_id in (select id from catalogs where owner_id = auth.uid())
  );

create policy "Owners can update their catalogs' orders"
  on orders for update
  using (
    catalog_id in (select id from catalogs where owner_id = auth.uid())
  );
```

- [ ] **Step 2: Apply the migration**

Open the Supabase Dashboard → SQL Editor for this project, paste the contents of the file above, and run it. (If the Supabase CLI is later linked to this project, `supabase db push` would apply the same file from `supabase/migrations/` — the file is saved to the repo either way so the change is tracked in git history.)

- [ ] **Step 3: Verify**

In the SQL Editor, run:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'orders'
order by ordinal_position;
```

Expected: `status`, `odoo_invoice_id`, `accepted_at`, `rejected_at` present with the types/defaults above.

```sql
select policyname from pg_policies where tablename = 'orders';
```

Expected: includes `"Owners can view their catalogs' orders"` and `"Owners can update their catalogs' orders"` alongside whatever public insert policy already existed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260801000000_orders_status_invoice.sql
git commit -m "feat: add order status, odoo invoice link, and owner RLS policies"
```

---

### Task 2: `Order` type + `orders` Pinia store

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/stores/orders.ts`
- Test: `src/stores/__tests__/orders.test.ts`

**Interfaces:**
- Consumes: `supabase` client from `src/lib/supabase.ts` (`.from(table).select/update/insert`, `.functions.invoke(name, { body })`), matching the pattern in `src/stores/products.ts`.
- Produces: `useOrderStore()` returning `{ orders: Ref<Order[]>, current: Ref<Order | null>, fetchByCatalog(catalogId: string): Promise<void>, fetchById(id: string): Promise<Order | null>, reject(id: string): Promise<void>, accept(id: string): Promise<Order> }`. `Order` type (exported from `src/types/index.ts`) gains `id`, `status`, `odoo_invoice_id`, `accepted_at`, `rejected_at`.

- [ ] **Step 1: Update the `Order` type**

In `src/types/index.ts`, replace the existing `Order` interface:

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

- [ ] **Step 2: Write the failing test**

Create `src/stores/__tests__/orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const fromMock = vi.fn()
const invokeMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}))

import { useOrderStore } from '../orders'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    catalog_id: 'cat1',
    customer_name: 'Juan',
    customer_email: null,
    customer_phone: null,
    items: [{ product_id: 'p1', quantity: 2 }],
    status: 'pending',
    odoo_invoice_id: null,
    created_at: '2026-08-01T00:00:00Z',
    accepted_at: null,
    rejected_at: null,
    ...overrides,
  }
}

describe('useOrderStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fromMock.mockReset()
    invokeMock.mockReset()
  })

  it('fetchByCatalog loads orders for a catalog', async () => {
    const order = makeOrder()
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [order], error: null }),
        }),
      }),
    })
    const store = useOrderStore()
    await store.fetchByCatalog('cat1')
    expect(store.orders).toEqual([order])
  })

  it('reject sets status to rejected via a conditional update', async () => {
    const rejected = makeOrder({ status: 'rejected', rejected_at: '2026-08-01T01:00:00Z' })
    fromMock.mockReturnValue({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: rejected, error: null }),
            }),
          }),
        }),
      }),
    })
    const store = useOrderStore()
    await store.reject('o1')
    expect(fromMock).toHaveBeenCalledWith('orders')
  })

  it('accept invokes the accept-order edge function and returns the updated order', async () => {
    const accepted = makeOrder({ status: 'accepted', odoo_invoice_id: 42 })
    invokeMock.mockResolvedValue({ data: { order: accepted }, error: null })
    const store = useOrderStore()
    const result = await store.accept('o1')
    expect(invokeMock).toHaveBeenCalledWith('accept-order', { body: { orderId: 'o1' } })
    expect(result.odoo_invoice_id).toBe(42)
  })

  it('accept throws when the edge function returns an error', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('ya fue gestionado') })
    const store = useOrderStore()
    await expect(store.accept('o1')).rejects.toThrow('ya fue gestionado')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:run -- src/stores/__tests__/orders.test.ts`
Expected: FAIL — `Cannot find module '../orders'` (the store doesn't exist yet).

- [ ] **Step 4: Implement the store**

Create `src/stores/orders.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Order } from '../types'

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const current = ref<Order | null>(null)

  async function fetchByCatalog(catalogId: string) {
    orders.value = []
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('created_at', { ascending: false })
    if (error) throw error
    orders.value = data
  }

  async function fetchById(id: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    current.value = data
    return data
  }

  async function reject(id: string): Promise<void> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single()
    if (error) throw error
    if (current.value?.id === id) current.value = data
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx !== -1) orders.value[idx] = data
  }

  async function accept(id: string): Promise<Order> {
    const { data, error } = await supabase.functions.invoke('accept-order', {
      body: { orderId: id },
    })
    if (error) throw error
    const updated = data.order as Order
    if (current.value?.id === id) current.value = updated
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx !== -1) orders.value[idx] = updated
    return updated
  }

  return { orders, current, fetchByCatalog, fetchById, reject, accept }
})
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/stores/__tests__/orders.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/stores/orders.ts src/stores/__tests__/orders.test.ts
git commit -m "feat: add orders store with fetch, accept, and reject"
```

---

### Task 3: `orderLink` in the WhatsApp message

**Files:**
- Modify: `src/lib/whatsapp.ts`
- Test: `src/lib/__tests__/whatsapp.test.ts`

**Interfaces:**
- Produces: `buildWhatsAppMessage(catalogName: string, items: CartItem[], customer: CustomerInfo, orderLink?: string): string` — 4th parameter is new and optional; existing 3-argument call sites keep compiling unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/whatsapp.test.ts`, inside the existing `describe('buildWhatsAppMessage', ...)` block (after the `'omits customer fields when not provided'` test):

```typescript
  it('includes order link when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], {}, 'https://example.com/orders/1')
    expect(msg).toContain('Ver pedido: https://example.com/orders/1')
  })

  it('omits order link when not provided', () => {
    const msg = buildWhatsAppMessage('Test', [], {})
    expect(msg).not.toContain('Ver pedido:')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/__tests__/whatsapp.test.ts`
Expected: FAIL on `'includes order link when provided'` — message does not contain `'Ver pedido:'`.

- [ ] **Step 3: Implement**

In `src/lib/whatsapp.ts`, replace `buildWhatsAppMessage`:

```typescript
export function buildWhatsAppMessage(
  catalogName: string,
  items: CartItem[],
  customer: CustomerInfo,
  orderLink?: string
): string {
  const lines: string[] = [`Hola! Mi pedido del catálogo ${catalogName}:`]
  for (const { product, quantity } of items) {
    lines.push(`- ${productLabel(product)} x${quantity}`)
  }
  if (customer.name) lines.push(`\nNombre: ${customer.name}`)
  if (customer.email) lines.push(`Correo: ${customer.email}`)
  if (customer.phone) lines.push(`Tel: ${customer.phone}`)
  if (orderLink) lines.push(`\nVer pedido: ${orderLink}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/__tests__/whatsapp.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/__tests__/whatsapp.test.ts
git commit -m "feat: add optional order link to WhatsApp message"
```

---

### Task 4: Wire the order link into `OrderModal.vue`

**Files:**
- Modify: `src/components/public/OrderModal.vue:36-52`

**Interfaces:**
- Consumes: `buildWhatsAppMessage(...)` 4th param from Task 3.

- [ ] **Step 1: Update the insert and message-building code**

In `src/components/public/OrderModal.vue`, replace the body of `send()` from the `orders.insert` call through the `buildWhatsAppUrl` call:

```typescript
    const { data: insertedOrder, error: dbError } = await supabase
      .from('orders')
      .insert({
        catalog_id: props.catalog.id,
        customer_name: customerName.value.trim() || null,
        customer_email: customerEmail.value.trim() || null,
        customer_phone: customerPhone.value.trim() || null,
        items: cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      })
      .select()
      .single()
    if (dbError) throw dbError

    const orderLink = `${window.location.origin}/orders/${insertedOrder.id}`
    const message = buildWhatsAppMessage(props.catalog.name, cart.items, {
      name: customerName.value.trim() || undefined,
      email: customerEmail.value.trim() || undefined,
      phone: customerPhone.value.trim() || undefined,
    }, orderLink)
    const url = buildWhatsAppUrl(props.whatsappNumber, message)
```

(The rest of `send()` — `window.open(url, '_blank')`, `cart.clear()`, `emit('close')`, the `catch`/`finally` — is unchanged.)

- [ ] **Step 2: Manual verification**

Run: `npm run dev`

1. Open a public catalog page (`/c/<slug>`), add a product to the cart, open the order modal, fill in a name, click "Enviar pedido por WhatsApp".
2. Before the WhatsApp tab takes over, check the browser's Network tab for the `orders` POST request — confirm the response includes an `id`.
3. Confirm the opened `wa.me` URL's decoded text ends with a line `Ver pedido: http://localhost:5173/orders/<that id>`.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/OrderModal.vue
git commit -m "feat: include order detail link in WhatsApp message"
```

---

### Task 5: `/orders/:id` route and `OrderDetailView.vue`

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/views/owner/OrderDetailView.vue`
- Modify: `.env.local` (add `VITE_ODOO_URL`)

**Interfaces:**
- Consumes: `useOrderStore()` (Task 2), `useCatalogStore()` (`fetchMyCatalogs`, `catalogs`), `useProductStore()` (`fetchByCatalog`, `products`), `productLabel(product)` from `src/lib/whatsapp.ts`.
- Produces: route `/orders/:id` (`requiresAuth: true`).

- [ ] **Step 1: Add the route**

In `src/router/index.ts`, add after the `/catalogs/:id` route entry:

```typescript
    {
      path: '/orders/:id',
      component: () => import('../views/owner/OrderDetailView.vue'),
      meta: { requiresAuth: true },
    },
```

- [ ] **Step 2: Add the Odoo URL env var**

In `.env.local`, add a new line:

```
VITE_ODOO_URL=https://fstest1.odoo.com
```

- [ ] **Step 3: Create the view**

Create `src/views/owner/OrderDetailView.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOrderStore } from '../../stores/orders'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import { productLabel } from '../../lib/whatsapp'
import type { Order, Catalog } from '../../types'

const route = useRoute()
const orderStore = useOrderStore()
const catalogStore = useCatalogStore()
const productStore = useProductStore()

const order = ref<Order | null>(null)
const catalog = ref<Catalog | null>(null)
const loading = ref(true)
const notFound = ref(false)
const actionLoading = ref(false)
const actionError = ref('')

const odooInvoiceUrl = computed(() => {
  if (!order.value?.odoo_invoice_id) return null
  return `${import.meta.env.VITE_ODOO_URL}/web#id=${order.value.odoo_invoice_id}&model=account.move&view_type=form`
})

function itemLabel(productId: string): string {
  const product = productStore.products.find(p => p.id === productId)
  return product ? productLabel(product) : productId
}

onMounted(async () => {
  try {
    const id = route.params.id as string
    const found = await orderStore.fetchById(id)
    if (!found) {
      notFound.value = true
      return
    }
    order.value = found

    let foundCatalog = catalogStore.catalogs.find(c => c.id === found.catalog_id)
    if (!foundCatalog) {
      await catalogStore.fetchMyCatalogs()
      foundCatalog = catalogStore.catalogs.find(c => c.id === found.catalog_id)
    }
    if (!foundCatalog) {
      notFound.value = true
      return
    }
    catalog.value = foundCatalog

    await productStore.fetchByCatalog(found.catalog_id)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
})

async function handleAccept() {
  if (!order.value) return
  actionLoading.value = true
  actionError.value = ''
  try {
    order.value = await orderStore.accept(order.value.id)
  } catch {
    actionError.value = 'No se pudo aceptar el pedido. Intenta de nuevo.'
  } finally {
    actionLoading.value = false
  }
}

async function handleReject() {
  if (!order.value) return
  actionLoading.value = true
  actionError.value = ''
  try {
    await orderStore.reject(order.value.id)
    order.value = { ...order.value, status: 'rejected' }
  } catch {
    actionError.value = 'No se pudo rechazar el pedido. Intenta de nuevo.'
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="loading" class="state">Cargando...</p>
    <p v-else-if="notFound" class="error">Pedido no encontrado.</p>
    <div v-else-if="order && catalog">
      <router-link :to="`/catalogs/${catalog.id}`" class="back">← {{ catalog.name }}</router-link>
      <h1>Pedido</h1>
      <span class="badge" :class="order.status">{{ order.status }}</span>

      <div class="customer">
        <p v-if="order.customer_name">Nombre: {{ order.customer_name }}</p>
        <p v-if="order.customer_email">Correo: {{ order.customer_email }}</p>
        <p v-if="order.customer_phone">Tel: {{ order.customer_phone }}</p>
      </div>

      <ul class="items">
        <li v-for="item in order.items" :key="item.product_id">
          {{ itemLabel(item.product_id) }} x{{ item.quantity }}
        </li>
      </ul>

      <p v-if="actionError" class="error">{{ actionError }}</p>

      <div v-if="order.status === 'pending'" class="actions">
        <button class="primary" :disabled="actionLoading" @click="handleAccept">
          {{ actionLoading ? 'Procesando...' : 'Aceptar' }}
        </button>
        <button :disabled="actionLoading" @click="handleReject">Rechazar</button>
      </div>

      <a v-if="odooInvoiceUrl" :href="odooInvoiceUrl" target="_blank" rel="noopener" class="invoice-link">
        Ver factura en Odoo ↗
      </a>
    </div>
  </div>
</template>

<style scoped>
.state { color: #9ca3af; margin-top: 1rem; }
.error { color: #dc2626; }
.back { color: #6b7280; font-size: 0.9rem; }
h1 { margin: 0.5rem 0; }
.badge { padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge.pending { background: #fef9c3; color: #854d0e; }
.badge.accepted { background: #dcfce7; color: #166534; }
.badge.rejected { background: #fee2e2; color: #991b1b; }
.customer { margin: 1rem 0; }
.items { list-style: none; padding: 0; margin: 1rem 0; }
.items li { padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; }
.actions { display: flex; gap: 0.5rem; margin: 1rem 0; }
.invoice-link { display: inline-block; margin-top: 1rem; }
</style>
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`

1. Log in, navigate to `/orders/<id>` for a real pending order id from the `orders` table.
2. Confirm customer info, item list, and "Aceptar"/"Rechazar" buttons render.
3. Click "Rechazar" — confirm the badge updates to `rejected` and the buttons disappear.
4. Repeat with a second pending order, click "Aceptar" — expect it to fail until Task 7's Edge Function exists (that's fine at this point in the plan); confirm `actionError` renders instead of a crash.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts src/views/owner/OrderDetailView.vue .env.local
git commit -m "feat: add order detail view with accept/reject actions"
```

---

### Task 6: "Pedidos" section in `CatalogDetailView.vue`

**Files:**
- Modify: `src/views/owner/CatalogDetailView.vue`

**Interfaces:**
- Consumes: `useOrderStore().fetchByCatalog(catalogId)` / `.orders` (Task 2).

- [ ] **Step 1: Fetch orders alongside products**

In `src/views/owner/CatalogDetailView.vue`, add the import and store next to the existing ones (near the top of `<script setup>`):

```typescript
import { useOrderStore } from '../../stores/orders'
```

```typescript
const orderStore = useOrderStore()
```

In the `onMounted` handler, change:

```typescript
    if (catalog.value) await productStore.fetchByCatalog(id)
```

to:

```typescript
    if (catalog.value) {
      await Promise.all([
        productStore.fetchByCatalog(id),
        orderStore.fetchByCatalog(id),
      ])
    }
```

- [ ] **Step 2: Add the "Pedidos" section to the template**

In the `<template>`, insert this block right after the `.link-box` div closes (after `</div>` that follows the "Copiar link" button) and before `<div class="products-section">`:

```html
    <div class="orders-section">
      <h2>Pedidos ({{ orderStore.orders.length }})</h2>
      <p v-if="orderStore.orders.length === 0" class="empty">Aún no hay pedidos.</p>
      <ul v-else class="order-list">
        <li v-for="order in orderStore.orders" :key="order.id">
          <router-link :to="`/orders/${order.id}`">
            {{ order.customer_name || 'Cliente sin nombre' }} —
            {{ order.items.length }} producto{{ order.items.length !== 1 ? 's' : '' }}
            <span class="badge" :class="order.status">{{ order.status }}</span>
          </router-link>
        </li>
      </ul>
    </div>
```

- [ ] **Step 3: Add matching styles**

In the `<style scoped>` block, add:

```css
.orders-section { margin-bottom: 2rem; }
.order-list { list-style: none; padding: 0; }
.order-list li { padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; }
.order-list a { display: flex; justify-content: space-between; align-items: center; color: inherit; text-decoration: none; }
.badge.pending { background: #fef9c3; color: #854d0e; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge.accepted { background: #dcfce7; color: #166534; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge.rejected { background: #fee2e2; color: #991b1b; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open a catalog with at least one order in `/catalogs/:id`. Confirm the "Pedidos" section lists it with the right customer name, item count, and status badge, and that clicking it navigates to `/orders/:id`.

- [ ] **Step 5: Commit**

```bash
git add src/views/owner/CatalogDetailView.vue
git commit -m "feat: show catalog orders in CatalogDetailView"
```

---

### Task 7: `accept-order` Supabase Edge Function

**Files:**
- Create: `supabase/functions/accept-order/index.ts`

**Interfaces:**
- Consumes: `orders` / `products` / `catalogs` tables (Task 1 columns), Odoo native `/mcp` endpoint (`ai_tool_search` confirmed available; the create-tool name is confirmed in Step 1 below).
- Produces: HTTP endpoint invoked as `supabase.functions.invoke('accept-order', { body: { orderId } })` (consumed by Task 2's `orders` store `accept()`), returning `{ order: Order }` on success or `{ error: string }` with a non-2xx status on failure.

- [ ] **Step 1: Enable Odoo write permissions and confirm the create-tool name**

In Odoo → Settings → MCP Server, for the user tied to the MCP API key, enable:
- `account.move`: read + create
- `account.move.line`: read + create
- `product.product`: read (should already be on, since `ai_tool_search` already works against it)

Then run this from a terminal to list the tools now exposed (replace the key if a new one was issued):

```bash
curl -s "https://fstest1.odoo.com/mcp" \
  -H "Authorization: Bearer 99db92b511e6a4c47af5d2d8b11f5e69865066b3" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Find the tool that creates records. The code below assumes it's named `ai_tool_create_record` and takes `{ model_name, values }` (`values` as a JSON-encoded object string, mirroring how `ai_tool_search`'s `domain` parameter is a JSON-encoded string) — matching the naming and parameter-encoding convention of the existing `ai_tool_*` tools. If `tools/list` shows a different name or parameter shape, update the `callOdooTool('ai_tool_create_record', ...)` call in Step 2 accordingly before deploying.

- [ ] **Step 2: Write the Edge Function**

Create `supabase/functions/accept-order/index.ts`:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ODOO_URL = Deno.env.get('ODOO_URL')!
const ODOO_MCP_API_KEY = Deno.env.get('ODOO_MCP_API_KEY')!
const ODOO_DEFAULT_PARTNER_ID = Number(Deno.env.get('ODOO_DEFAULT_PARTNER_ID')!)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface OrderItem {
  product_id: string
  quantity: number
}

interface OdooInvoiceLine {
  product_id?: number
  name: string
  quantity: number
  price_unit?: number
}

let mcpRequestId = 0

async function callOdooTool(toolName: string, args: Record<string, unknown>) {
  mcpRequestId++
  const res = await fetch(`${ODOO_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ODOO_MCP_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: mcpRequestId,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  })
  if (!res.ok) {
    throw new Error(`Odoo MCP request failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  if (json.error) {
    throw new Error(`Odoo MCP error: ${json.error.message ?? JSON.stringify(json.error)}`)
  }
  return json.result
}

function extractRecords(mcpResult: unknown): Array<Record<string, unknown>> {
  const content = (mcpResult as { content?: Array<{ text?: string }> })?.content
  const text = content?.[0]?.text
  if (!text) return []
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : ((parsed.records as Array<Record<string, unknown>>) ?? [])
}

function extractCreatedId(mcpResult: unknown): number {
  const content = (mcpResult as { content?: Array<{ text?: string }> })?.content
  const text = content?.[0]?.text
  if (!text) throw new Error('Respuesta inesperada de Odoo al crear la factura')
  const parsed = JSON.parse(text)
  const id = parsed.id ?? parsed[0]?.id ?? parsed
  if (typeof id !== 'number') throw new Error('No se pudo determinar el ID de la factura creada')
  return id
}

async function findOdooProduct(reference: string): Promise<{ id: number; name: string } | null> {
  const result = await callOdooTool('ai_tool_search', {
    model_name: 'product.product',
    domain: JSON.stringify([['default_code', '=', reference]]),
    fields: ['id', 'name'],
    limit: 1,
  })
  const records = extractRecords(result)
  return records.length > 0
    ? { id: records[0].id as number, name: records[0].name as string }
    : null
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
    }

    const { orderId } = await req.json()
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), { status: 400 })
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('*, catalogs!inner(owner_id)')
      .eq('id', orderId)
      .single()
    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 })
    }
    if (order.catalogs.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized for this order' }), { status: 403 })
    }

    const { data: claimed, error: claimError } = await adminClient
      .from('orders')
      .update({ status: 'accepted' })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select()
      .single()
    if (claimError || !claimed) {
      return new Response(JSON.stringify({ error: 'Este pedido ya fue gestionado' }), { status: 409 })
    }

    try {
      const items = order.items as OrderItem[]
      const { data: products } = await adminClient
        .from('products')
        .select('id, reference, name')
        .in('id', items.map(i => i.product_id))

      const lines: OdooInvoiceLine[] = []
      for (const item of items) {
        const product = products?.find(p => p.id === item.product_id)
        const reference = product?.reference ?? item.product_id
        const name = product?.name ?? 'Producto'
        const odooProduct = await findOdooProduct(reference)
        if (odooProduct) {
          lines.push({ product_id: odooProduct.id, name: odooProduct.name, quantity: item.quantity })
        } else {
          lines.push({
            name: `[${reference}] ${name} (no encontrado en Odoo)`,
            quantity: item.quantity,
            price_unit: 0,
          })
        }
      }

      const invoiceResult = await callOdooTool('ai_tool_create_record', {
        model_name: 'account.move',
        values: JSON.stringify({
          move_type: 'out_invoice',
          partner_id: ODOO_DEFAULT_PARTNER_ID,
          invoice_line_ids: lines.map(line => [0, 0, line]),
        }),
      })
      const invoiceId = extractCreatedId(invoiceResult)

      const { data: finalOrder, error: updateError } = await adminClient
        .from('orders')
        .update({ odoo_invoice_id: invoiceId, accepted_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single()
      if (updateError) throw updateError

      return new Response(JSON.stringify({ order: finalOrder }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (odooError) {
      await adminClient.from('orders').update({ status: 'pending' }).eq('id', orderId)
      return new Response(
        JSON.stringify({ error: `No se pudo crear la factura en Odoo: ${(odooError as Error).message}` }),
        { status: 502 }
      )
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})
```

- [ ] **Step 3: Set secrets and deploy**

```bash
supabase secrets set ODOO_URL=https://fstest1.odoo.com
supabase secrets set ODOO_MCP_API_KEY=99db92b511e6a4c47af5d2d8b11f5e69865066b3
supabase secrets set ODOO_DEFAULT_PARTNER_ID=<id of the chosen default Odoo customer>
supabase functions deploy accept-order
```

(If the project isn't yet linked to the Supabase CLI, run `supabase login` then `supabase link --project-ref aiymtsmwjyqrmlmikivk` first.)

- [ ] **Step 4: Manual verification against the Odoo sandbox**

1. Pick a real `pending` order id from the `orders` table that has at least one item whose `reference` matches a product already in Odoo (from the earlier `products_import_dina_catalog.xlsx` import) and one that doesn't.
2. Get a valid user JWT (from the browser's Supabase session, e.g. via devtools `localStorage`, or `supabase.auth.getSession()` in the console) and call:

```bash
curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/accept-order" \
  -H "Authorization: Bearer <user JWT>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "<the order id>"}'
```

3. Confirm the response is `200` with `{"order": {..., "status": "accepted", "odoo_invoice_id": <number>}}`.
4. In Odoo, open `https://fstest1.odoo.com/web#id=<that number>&model=account.move&view_type=form` and confirm: the invoice exists, is in **Draft** state, has one line per order item (matched items show the Odoo product; unmatched items show the fallback text line at price 0).
5. Call the same curl command again with the same `orderId` — confirm it now returns `409` with `"Este pedido ya fue gestionado"` and Odoo does **not** get a second invoice.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/accept-order/index.ts
git commit -m "feat: add accept-order edge function creating draft Odoo invoices"
```

---

## Self-Review Notes

- **Spec coverage:** order status + link in WA message (Task 3–4), admin order view (Task 5), Pedidos list per catalog (Task 6), accept → draft Odoo invoice (Task 7), reject (Task 2 store + Task 5 view), invoice link surfaced in dashboard (Task 5 + Task 6), RLS/security (Task 1, Task 7 ownership check) — all covered.
- **Placeholder scan:** no TBD/TODO left; the one genuine unknown (Odoo's create-tool name) is resolved by a concrete discovery step (Task 7 Step 1) with an exact command, not left vague.
- **Type consistency:** `Order` (Task 2) is used identically in Task 5/6/7; `orderLink` param name matches between Task 3's `buildWhatsAppMessage` and Task 4's call site; `accept-order`'s response shape `{ order: Order }` matches what Task 2's store reads (`data.order`).
