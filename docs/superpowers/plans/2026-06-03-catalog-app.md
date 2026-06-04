# Dina Catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack catalog web app where business owners create product catalogs shared via link, and customers build orders sent through WhatsApp.

**Architecture:** Single-page Vue 3 app with two zones — authenticated owner dashboard and public catalog view. All data in Supabase (Auth + PostgreSQL + Storage). No server-side code.

**Tech Stack:** Vue 3, TypeScript, Vite, Vue Router 4, Pinia, Supabase JS v2, Vitest, @vue/test-utils

---

## File Map

### New files to create

**Library / utilities**
- `src/lib/supabase.ts` — Supabase client singleton
- `src/lib/slugify.ts` — Slug generation from catalog name
- `src/lib/whatsapp.ts` — WhatsApp message and URL builder
- `src/types/index.ts` — Shared TypeScript interfaces

**Stores (Pinia)**
- `src/stores/auth.ts` — Auth state, login/signup/logout, profile loading
- `src/stores/catalog.ts` — Catalog CRUD + fetch by slug
- `src/stores/products.ts` — Product CRUD + image upload to Supabase Storage
- `src/stores/cart.ts` — Cart state for public view (quantity per product)

**Router**
- `src/router/index.ts` — All routes + auth guard

**Owner views**
- `src/views/auth/LoginView.vue` — Login + signup form
- `src/views/owner/DashboardView.vue` — Catalog list with toggle and link copy
- `src/views/owner/CatalogNewView.vue` — Create catalog form
- `src/views/owner/CatalogDetailView.vue` — Catalog products, link, active toggle
- `src/views/owner/ProductNewView.vue` — Add product form with image upload

**Public views + components**
- `src/views/public/CatalogPublicView.vue` — Public product table + order flow
- `src/components/public/ProductTableRow.vue` — Product row with quantity controls
- `src/components/public/CartFloat.vue` — Floating total-items button
- `src/components/public/OrderModal.vue` — Order summary + customer info + WhatsApp send

**Tests**
- `src/lib/__tests__/slugify.test.ts`
- `src/lib/__tests__/whatsapp.test.ts`
- `src/stores/__tests__/cart.test.ts`

### Files to modify
- `src/main.ts` — Add router + Pinia, init auth before mount
- `src/App.vue` — Replace default content with RouterView + nav bar
- `vite.config.ts` — Add Vitest test config
- `package.json` — Add dependencies and test script

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install vue-router@4 pinia @supabase/supabase-js
```

Expected: packages added, no errors.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @vue/test-utils happy-dom @vitest/coverage-v8
```

Expected: packages added, no errors.

- [ ] **Step 3: Add test scripts to package.json**

Read `package.json`. In the `"scripts"` object, add:
```json
"test": "vitest",
"test:run": "vitest run",
"coverage": "vitest run --coverage"
```

- [ ] **Step 4: Add Vitest config to vite.config.ts**

Read `vite.config.ts`, then replace its content with:
```typescript
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

- [ ] **Step 5: Verify Vitest runs**

```bash
npx vitest run
```

Expected: "No test files found" or exits cleanly — no crash.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts package-lock.json
git commit -m "chore: add vue-router, pinia, supabase-js, vitest"
```

---

## Task 2: TypeScript types and Supabase client

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/supabase.ts`
- Create: `.env.local` (not committed)

- [ ] **Step 1: Create type definitions**

Create `src/types/index.ts`:
```typescript
export interface Profile {
  id: string
  full_name: string | null
  whatsapp_number: string | null
}

export interface Catalog {
  id: string
  owner_id: string
  name: string
  slug: string
  whatsapp_number: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  catalog_id: string
  reference: string
  name: string
  measurements: string
  quality: string
  image_url: string | null
  created_at: string
}

export interface OrderItem {
  product_id: string
  quantity: number
}

export interface Order {
  catalog_id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  items: OrderItem[]
}

export interface CartItem {
  product: Product
  quantity: number
}
```

- [ ] **Step 2: Create .env.local**

Create `.env.local` in the project root (this file must NOT be committed — verify it is covered by `.gitignore`):
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace values with your actual Supabase project URL and anon key (Supabase dashboard → Project Settings → API).

- [ ] **Step 3: Verify .env.local is gitignored**

```bash
cat .gitignore
```

Confirm `*.local` or `.env.local` appears. If not, add `.env.local` to `.gitignore` and `git add .gitignore`.

- [ ] **Step 4: Create Supabase client**

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/supabase.ts
git commit -m "feat: add TypeScript types and Supabase client"
```

---

## Task 3: Supabase database schema, RLS, and Storage

This task runs SQL in the Supabase dashboard — no local files.

- [ ] **Step 1: Open SQL Editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Run schema migration**

Paste and run:
```sql
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  whatsapp_number text,
  created_at timestamptz default now()
);

create table public.catalogs (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  slug text unique not null,
  whatsapp_number text,
  is_active boolean default true not null,
  created_at timestamptz default now()
);

create table public.products (
  id uuid default gen_random_uuid() primary key,
  catalog_id uuid references public.catalogs(id) on delete cascade not null,
  reference text not null,
  name text not null,
  measurements text not null,
  quality text not null,
  image_url text,
  created_at timestamptz default now()
);

create table public.orders (
  id uuid default gen_random_uuid() primary key,
  catalog_id uuid references public.catalogs(id) on delete set null,
  customer_name text,
  customer_email text,
  customer_phone text,
  items jsonb not null default '[]',
  created_at timestamptz default now()
);
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Run RLS policies**

Paste and run:
```sql
alter table public.profiles enable row level security;
alter table public.catalogs enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- catalogs: owner manages all; anyone can read active ones
create policy "catalogs_all_owner" on public.catalogs
  for all using (auth.uid() = owner_id);
create policy "catalogs_select_active" on public.catalogs
  for select using (is_active = true);

-- products: owner manages; anyone reads products of active catalogs
create policy "products_all_owner" on public.products
  for all using (
    auth.uid() = (select owner_id from public.catalogs where id = catalog_id)
  );
create policy "products_select_active_catalog" on public.products
  for select using (
    (select is_active from public.catalogs where id = catalog_id) = true
  );

-- orders: anyone inserts; catalog owner reads
create policy "orders_insert_anon" on public.orders
  for insert with check (true);
create policy "orders_select_owner" on public.orders
  for select using (
    auth.uid() = (select owner_id from public.catalogs where id = catalog_id)
  );
```

Expected: "Success. No rows returned."

- [ ] **Step 4: Create Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `product-images`
- Public: **YES**

Then in Storage → Policies for `product-images`, add a policy:
- Operation: INSERT
- Target roles: authenticated
- Policy: `(auth.role() = 'authenticated')`

- [ ] **Step 5: No commit needed** (schema lives in Supabase, not in the repo)

---

## Task 4: Slugify utility (TDD)

**Files:**
- Create: `src/lib/__tests__/slugify.test.ts`
- Create: `src/lib/slugify.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/slugify.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { slugify, generateCatalogSlug } from '../slugify'

describe('slugify', () => {
  it('lowercases text', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes accents', () => {
    expect(slugify('Colección Verano')).toBe('coleccion-verano')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('my catalog name')).toBe('my-catalog-name')
  })

  it('removes special characters', () => {
    expect(slugify('Catálogo #1!')).toBe('catalogo-1')
  })

  it('collapses multiple spaces', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })
})

describe('generateCatalogSlug', () => {
  it('starts with slugified name', () => {
    const result = generateCatalogSlug('Mi Catálogo')
    expect(result).toMatch(/^mi-catalogo-/)
  })

  it('ends with 4-char alphanumeric suffix', () => {
    const result = generateCatalogSlug('Test')
    expect(result).toMatch(/^test-[a-z0-9]{4}$/)
  })

  it('generates different slugs for the same name', () => {
    const a = generateCatalogSlug('Verano')
    const b = generateCatalogSlug('Verano')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/__tests__/slugify.test.ts
```

Expected: FAIL — "Cannot find module '../slugify'"

- [ ] **Step 3: Implement slugify.ts**

Create `src/lib/slugify.ts`:
```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function generateCatalogSlug(name: string): string {
  const base = slugify(name)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/__tests__/slugify.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slugify.ts src/lib/__tests__/slugify.test.ts
git commit -m "feat: add slugify utility with tests"
```

---

## Task 5: WhatsApp utility (TDD)

**Files:**
- Create: `src/lib/__tests__/whatsapp.test.ts`
- Create: `src/lib/whatsapp.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/whatsapp.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../whatsapp'
import type { CartItem } from '../../types'

const makeProduct = (ref: string, name: string) => ({
  id: '1',
  catalog_id: 'cat1',
  reference: ref,
  name,
  measurements: '10x20',
  quality: 'Alta',
  image_url: null,
  created_at: '',
})

describe('buildWhatsAppMessage', () => {
  it('includes catalog name in greeting', () => {
    const msg = buildWhatsAppMessage('Verano 2025', [], {})
    expect(msg).toContain('Verano 2025')
  })

  it('lists each product with reference and quantity', () => {
    const items: CartItem[] = [
      { product: makeProduct('REF01', 'Camisa'), quantity: 2 },
      { product: makeProduct('REF02', 'Pantalón'), quantity: 1 },
    ]
    const msg = buildWhatsAppMessage('Test', items, {})
    expect(msg).toContain('[REF01] Camisa x2')
    expect(msg).toContain('[REF02] Pantalón x1')
  })

  it('includes customer name when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], { name: 'Juan' })
    expect(msg).toContain('Nombre: Juan')
  })

  it('includes customer email when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], { email: 'a@b.com' })
    expect(msg).toContain('Correo: a@b.com')
  })

  it('includes customer phone when provided', () => {
    const msg = buildWhatsAppMessage('Test', [], { phone: '123456' })
    expect(msg).toContain('Tel: 123456')
  })

  it('omits customer fields when not provided', () => {
    const msg = buildWhatsAppMessage('Test', [], {})
    expect(msg).not.toContain('Nombre:')
    expect(msg).not.toContain('Correo:')
    expect(msg).not.toContain('Tel:')
  })
})

describe('buildWhatsAppUrl', () => {
  it('strips non-digits from phone number', () => {
    const url = buildWhatsAppUrl('+57 300 123-4567', 'hola')
    expect(url).toContain('573001234567')
  })

  it('URL-encodes the message', () => {
    const url = buildWhatsAppUrl('123', 'hola mundo')
    expect(url).toContain(encodeURIComponent('hola mundo'))
  })

  it('returns a wa.me URL', () => {
    const url = buildWhatsAppUrl('123', 'test')
    expect(url).toMatch(/^https:\/\/wa\.me\//)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/__tests__/whatsapp.test.ts
```

Expected: FAIL — "Cannot find module '../whatsapp'"

- [ ] **Step 3: Implement whatsapp.ts**

Create `src/lib/whatsapp.ts`:
```typescript
import type { CartItem } from '../types'

interface CustomerInfo {
  name?: string
  email?: string
  phone?: string
}

export function buildWhatsAppMessage(
  catalogName: string,
  items: CartItem[],
  customer: CustomerInfo
): string {
  const lines: string[] = [`Hola! Mi pedido del catálogo ${catalogName}:`]
  for (const { product, quantity } of items) {
    lines.push(`- [${product.reference}] ${product.name} x${quantity}`)
  }
  if (customer.name) lines.push(`\nNombre: ${customer.name}`)
  if (customer.email) lines.push(`Correo: ${customer.email}`)
  if (customer.phone) lines.push(`Tel: ${customer.phone}`)
  return lines.join('\n')
}

export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/__tests__/whatsapp.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp.ts src/lib/__tests__/whatsapp.test.ts
git commit -m "feat: add WhatsApp message builder with tests"
```

---

## Task 6: Cart store (TDD)

**Files:**
- Create: `src/stores/__tests__/cart.test.ts`
- Create: `src/stores/cart.ts`

- [ ] **Step 1: Write failing tests**

Create `src/stores/__tests__/cart.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '../cart'
import type { Product } from '../../types'

const makeProduct = (id: string): Product => ({
  id,
  catalog_id: 'cat1',
  reference: `REF-${id}`,
  name: `Product ${id}`,
  measurements: '10x20',
  quality: 'Alta',
  image_url: null,
  created_at: '',
})

describe('useCartStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const cart = useCartStore()
    expect(cart.items).toHaveLength(0)
    expect(cart.totalItems).toBe(0)
  })

  it('adds a product', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    expect(cart.items).toHaveLength(1)
    expect(cart.getQuantity('a')).toBe(1)
  })

  it('increments quantity on repeat add', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('a'))
    expect(cart.items).toHaveLength(1)
    expect(cart.getQuantity('a')).toBe(2)
  })

  it('decrements quantity on removeItem', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('a'))
    cart.removeItem('a')
    expect(cart.getQuantity('a')).toBe(1)
  })

  it('removes item when quantity reaches 0', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.removeItem('a')
    expect(cart.items).toHaveLength(0)
    expect(cart.getQuantity('a')).toBe(0)
  })

  it('totalItems sums all quantities', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('b'))
    expect(cart.totalItems).toBe(3)
  })

  it('clear empties the cart', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.clear()
    expect(cart.items).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/stores/__tests__/cart.test.ts
```

Expected: FAIL — "Cannot find module '../cart'"

- [ ] **Step 3: Implement cart.ts**

Create `src/stores/cart.ts`:
```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Product } from '../types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  function addItem(product: Product) {
    const existing = items.value.find(i => i.product.id === product.id)
    if (existing) {
      existing.quantity++
    } else {
      items.value.push({ product, quantity: 1 })
    }
  }

  function removeItem(productId: string) {
    const existing = items.value.find(i => i.product.id === productId)
    if (!existing) return
    if (existing.quantity > 1) {
      existing.quantity--
    } else {
      items.value = items.value.filter(i => i.product.id !== productId)
    }
  }

  function getQuantity(productId: string): number {
    return items.value.find(i => i.product.id === productId)?.quantity ?? 0
  }

  function clear() {
    items.value = []
  }

  return { items, totalItems, addItem, removeItem, getQuantity, clear }
})
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/stores/__tests__/cart.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/cart.ts src/stores/__tests__/cart.test.ts
git commit -m "feat: add cart store with tests"
```

---

## Task 7: Auth, catalog, and products stores

**Files:**
- Create: `src/stores/auth.ts`
- Create: `src/stores/catalog.ts`
- Create: `src/stores/products.ts`

- [ ] **Step 1: Create auth store**

Create `src/stores/auth.ts`:
```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    if (user.value) await loadProfile()

    supabase.auth.onAuthStateChange(async (_, session) => {
      user.value = session?.user ?? null
      if (user.value) await loadProfile()
      else profile.value = null
    })
  }

  async function loadProfile() {
    if (!user.value) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    profile.value = data
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    whatsappNumber: string
  ) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        whatsapp_number: whatsappNumber,
      })
      if (profileError) throw profileError
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  return { user, profile, init, signUp, signIn, signOut }
})
```

- [ ] **Step 2: Create catalog store**

Create `src/stores/catalog.ts`:
```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { generateCatalogSlug } from '../lib/slugify'
import type { Catalog } from '../types'

export const useCatalogStore = defineStore('catalog', () => {
  const catalogs = ref<Catalog[]>([])

  async function fetchMyCatalogs() {
    const { data, error } = await supabase
      .from('catalogs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    catalogs.value = data
  }

  async function createCatalog(name: string, whatsappNumber?: string): Promise<Catalog> {
    const slug = generateCatalogSlug(name)
    const { data, error } = await supabase
      .from('catalogs')
      .insert({ name, slug, whatsapp_number: whatsappNumber ?? null, is_active: true })
      .select()
      .single()
    if (error) throw error
    catalogs.value.unshift(data)
    return data
  }

  async function toggleActive(id: string, isActive: boolean) {
    const { error } = await supabase
      .from('catalogs')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw error
    const catalog = catalogs.value.find(c => c.id === id)
    if (catalog) catalog.is_active = isActive
  }

  async function fetchBySlug(slug: string): Promise<Catalog | null> {
    const { data } = await supabase
      .from('catalogs')
      .select('*')
      .eq('slug', slug)
      .single()
    return data
  }

  return { catalogs, fetchMyCatalogs, createCatalog, toggleActive, fetchBySlug }
})
```

- [ ] **Step 3: Create products store**

Create `src/stores/products.ts`:
```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])

  async function fetchByCatalog(catalogId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('created_at', { ascending: true })
    if (error) throw error
    products.value = data
  }

  async function addProduct(
    catalogId: string,
    fields: { reference: string; name: string; measurements: string; quality: string },
    imageFile?: File
  ): Promise<Product> {
    let image_url: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${catalogId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ catalog_id: catalogId, ...fields, image_url })
      .select()
      .single()
    if (error) throw error
    products.value.push(data)
    return data
  }

  return { products, fetchByCatalog, addProduct }
})
```

- [ ] **Step 4: Run all tests to verify nothing broke**

```bash
npx vitest run
```

Expected: All existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/auth.ts src/stores/catalog.ts src/stores/products.ts
git commit -m "feat: add auth, catalog, and products Pinia stores"
```

---

## Task 8: Vue Router and app wiring

**Files:**
- Create: `src/router/index.ts`
- Modify: `src/main.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Create router**

Create `src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('../views/auth/LoginView.vue'),
    },
    {
      path: '/dashboard',
      component: () => import('../views/owner/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/catalogs/new',
      component: () => import('../views/owner/CatalogNewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/catalogs/:id',
      component: () => import('../views/owner/CatalogDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/catalogs/:id/products/new',
      component: () => import('../views/owner/ProductNewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/c/:slug',
      component: () => import('../views/public/CatalogPublicView.vue'),
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return '/login'
  }
})

export default router
```

- [ ] **Step 2: Update main.ts**

Read `src/main.ts`, then replace with:
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const auth = useAuthStore()
auth.init().then(() => {
  app.mount('#app')
})
```

- [ ] **Step 3: Update App.vue**

Read `src/App.vue`, then replace with:
```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function logout() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="app">
    <nav v-if="auth.user" class="nav">
      <router-link to="/dashboard">Mis catálogos</router-link>
      <button @click="logout">Cerrar sesión</button>
    </nav>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
.app { min-height: 100vh; }
.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.875rem 2rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.nav a { text-decoration: none; color: #333; font-weight: 500; font-size: 0.95rem; }
.nav a:hover { color: #18a34a; }
main { padding: 2rem; max-width: 960px; margin: 0 auto; }
button {
  cursor: pointer;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 0.9rem;
  transition: background 0.1s;
}
button:hover:not(:disabled) { background: #f9fafb; }
button.primary { background: #18a34a; color: #fff; border-color: #18a34a; }
button.primary:hover:not(:disabled) { background: #16923f; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 0.75rem;
  outline: none;
  transition: border-color 0.15s;
}
input:focus { border-color: #18a34a; }
.error { color: #dc2626; margin: 0.5rem 0 0.75rem; font-size: 0.9rem; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts src/main.ts src/App.vue
git commit -m "feat: wire up Vue Router and Pinia in main app"
```

---

## Task 9: Login / Signup view

**Files:**
- Create: `src/views/auth/LoginView.vue`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/views/auth
```

Create `src/views/auth/LoginView.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const fullName = ref('')
const whatsappNumber = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    if (isSignUp.value) {
      await auth.signUp(email.value, password.value, fullName.value, whatsappNumber.value)
    } else {
      await auth.signIn(email.value, password.value)
    }
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-box">
      <h1>{{ isSignUp ? 'Crear cuenta' : 'Iniciar sesión' }}</h1>
      <form @submit.prevent="submit">
        <input v-model="email" type="email" placeholder="Correo electrónico" required />
        <input v-model="password" type="password" placeholder="Contraseña" required />
        <template v-if="isSignUp">
          <input v-model="fullName" type="text" placeholder="Nombre completo" required />
          <input
            v-model="whatsappNumber"
            type="tel"
            placeholder="Número WhatsApp (ej: +573001234567)"
            required
          />
        </template>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="primary" :disabled="loading" style="width:100%">
          {{ loading ? 'Cargando...' : (isSignUp ? 'Crear cuenta' : 'Entrar') }}
        </button>
      </form>
      <p class="toggle-link">
        <a href="#" @click.prevent="isSignUp = !isSignUp; error = ''">
          {{ isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate' }}
        </a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
}
.login-box {
  background: #fff;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 400px;
}
h1 { margin-bottom: 1.5rem; font-size: 1.4rem; }
.toggle-link { margin-top: 1rem; text-align: center; }
.toggle-link a { color: #18a34a; text-decoration: none; font-size: 0.9rem; }
</style>
```

- [ ] **Step 2: Start dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:5173/login`. Confirm: login form renders, toggle between login/signup works, extra fields appear on signup.

- [ ] **Step 3: Commit**

```bash
git add src/views/auth/LoginView.vue
git commit -m "feat: add login and signup view"
```

---

## Task 10: Dashboard view

**Files:**
- Create: `src/views/owner/DashboardView.vue`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/views/owner
```

Create `src/views/owner/DashboardView.vue`:
```vue
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'

const router = useRouter()
const catalogStore = useCatalogStore()

const publicBase = computed(() => window.location.origin)

onMounted(() => catalogStore.fetchMyCatalogs())

async function toggleActive(id: string, current: boolean) {
  await catalogStore.toggleActive(id, !current)
}

function copyLink(slug: string) {
  navigator.clipboard.writeText(`${publicBase.value}/c/${slug}`)
}
</script>

<template>
  <div>
    <div class="header">
      <h1>Mis catálogos</h1>
      <router-link to="/catalogs/new">
        <button class="primary">+ Nuevo catálogo</button>
      </router-link>
    </div>

    <p v-if="catalogStore.catalogs.length === 0" class="empty">
      Aún no tienes catálogos. ¡Crea el primero!
    </p>

    <div class="catalog-list">
      <div
        v-for="catalog in catalogStore.catalogs"
        :key="catalog.id"
        class="catalog-card"
        @click="router.push(`/catalogs/${catalog.id}`)"
      >
        <div class="card-top">
          <div class="card-name">
            <strong>{{ catalog.name }}</strong>
            <span class="badge" :class="catalog.is_active ? 'active' : 'inactive'">
              {{ catalog.is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </div>
          <div class="card-actions" @click.stop>
            <button @click="copyLink(catalog.slug)">Copiar link</button>
            <button @click="toggleActive(catalog.id, catalog.is_active)">
              {{ catalog.is_active ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
        </div>
        <p class="slug">/c/{{ catalog.slug }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.catalog-list { display: flex; flex-direction: column; gap: 0.75rem; }
.catalog-card {
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.catalog-card:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.1); }
.card-top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.card-name { display: flex; align-items: center; gap: 0.5rem; }
.card-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.badge {
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
}
.active { background: #dcfce7; color: #166534; }
.inactive { background: #f3f4f6; color: #6b7280; }
.slug { color: #9ca3af; font-size: 0.8rem; margin-top: 0.4rem; }
.empty { color: #9ca3af; margin-top: 3rem; text-align: center; }
</style>
```

- [ ] **Step 2: Verify in browser**

Sign up at `/login`. Confirm redirect to `/dashboard` shows "Mis catálogos" with a "Nuevo catálogo" button.

- [ ] **Step 3: Commit**

```bash
git add src/views/owner/DashboardView.vue
git commit -m "feat: add dashboard view"
```

---

## Task 11: Create catalog view

**Files:**
- Create: `src/views/owner/CatalogNewView.vue`

- [ ] **Step 1: Create CatalogNewView**

Create `src/views/owner/CatalogNewView.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const catalogStore = useCatalogStore()
const auth = useAuthStore()

const name = ref('')
const whatsappOverride = ref('')
const error = ref('')
const loading = ref(false)

async function create() {
  if (!name.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    // Always store an effective whatsapp_number so the public view can use it
    // without querying the profiles table (which has owner-only RLS).
    const effectiveWhatsapp =
      whatsappOverride.value.trim() || auth.profile?.whatsapp_number || ''
    const catalog = await catalogStore.createCatalog(name.value.trim(), effectiveWhatsapp)
    router.push(`/catalogs/${catalog.id}`)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1>Nuevo catálogo</h1>
    <form @submit.prevent="create" class="form">
      <label>Nombre del catálogo *</label>
      <input v-model="name" type="text" placeholder="Ej: Colección Verano 2025" required />

      <label>Número WhatsApp para pedidos (opcional)</label>
      <input
        v-model="whatsappOverride"
        type="tel"
        placeholder="Deja vacío para usar el de tu perfil"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="button" @click="router.back()">Cancelar</button>
        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? 'Creando...' : 'Crear catálogo' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page { max-width: 480px; }
h1 { margin-bottom: 1.5rem; }
.form {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
label { display: block; font-weight: 500; margin-bottom: 0.3rem; font-size: 0.9rem; color: #374151; }
.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
</style>
```

- [ ] **Step 2: Verify in browser**

Click "Nuevo catálogo" from the dashboard, fill in a name, submit. Confirm redirect to the catalog detail URL (next task will render content).

- [ ] **Step 3: Commit**

```bash
git add src/views/owner/CatalogNewView.vue
git commit -m "feat: add create catalog view"
```

---

## Task 12: Catalog detail view

**Files:**
- Create: `src/views/owner/CatalogDetailView.vue`

- [ ] **Step 1: Create CatalogDetailView**

Create `src/views/owner/CatalogDetailView.vue`:
```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import type { Catalog } from '../../types'

const route = useRoute()
const router = useRouter()
const catalogStore = useCatalogStore()
const productStore = useProductStore()

const catalog = ref<Catalog | null>(null)
const loading = ref(true)

const publicLink = computed(() =>
  catalog.value ? `${window.location.origin}/c/${catalog.value.slug}` : ''
)

onMounted(async () => {
  const id = route.params.id as string
  let found = catalogStore.catalogs.find(c => c.id === id)
  if (!found) {
    await catalogStore.fetchMyCatalogs()
    found = catalogStore.catalogs.find(c => c.id === id)
  }
  catalog.value = found ?? null
  if (catalog.value) await productStore.fetchByCatalog(id)
  loading.value = false
})

async function toggle() {
  if (!catalog.value) return
  const next = !catalog.value.is_active
  await catalogStore.toggleActive(catalog.value.id, next)
  catalog.value.is_active = next
}

function copyLink() {
  navigator.clipboard.writeText(publicLink.value)
}
</script>

<template>
  <div v-if="loading" class="loading">Cargando...</div>
  <div v-else-if="!catalog" class="loading">Catálogo no encontrado.</div>
  <div v-else>
    <div class="header">
      <div>
        <router-link to="/dashboard" class="back">← Mis catálogos</router-link>
        <h1>{{ catalog.name }}</h1>
      </div>
      <div class="header-actions">
        <button @click="toggle">
          {{ catalog.is_active ? 'Desactivar' : 'Activar' }}
        </button>
        <router-link :to="`/catalogs/${catalog.id}/products/new`">
          <button class="primary">+ Agregar producto</button>
        </router-link>
      </div>
    </div>

    <div class="link-box">
      <span class="badge" :class="catalog.is_active ? 'active' : 'inactive'">
        {{ catalog.is_active ? 'Activo' : 'Inactivo' }}
      </span>
      <code>{{ publicLink }}</code>
      <button @click="copyLink">Copiar link</button>
    </div>

    <div class="products-section">
      <h2>Productos ({{ productStore.products.length }})</h2>
      <p v-if="productStore.products.length === 0" class="empty">
        Aún no hay productos. ¡Agrega el primero!
      </p>
      <table v-else class="product-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Referencia</th>
            <th>Nombre</th>
            <th>Medidas</th>
            <th>Calidad</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in productStore.products" :key="product.id">
            <td>
              <img v-if="product.image_url" :src="product.image_url" class="thumb" alt="" />
              <span v-else class="no-img">—</span>
            </td>
            <td>{{ product.reference }}</td>
            <td>{{ product.name }}</td>
            <td>{{ product.measurements }}</td>
            <td>{{ product.quality }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.loading { color: #9ca3af; margin-top: 2rem; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.back { font-size: 0.85rem; color: #6b7280; text-decoration: none; display: block; margin-bottom: 0.25rem; }
.back:hover { color: #18a34a; }
h1 { font-size: 1.5rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; padding-top: 1.5rem; }
.link-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fff;
  border-radius: 8px;
  padding: 0.875rem 1rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  flex-wrap: wrap;
}
code { flex: 1; font-size: 0.8rem; color: #555; word-break: break-all; }
.badge {
  white-space: nowrap;
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
}
.active { background: #dcfce7; color: #166534; }
.inactive { background: #f3f4f6; color: #6b7280; }
.products-section h2 { margin-bottom: 1rem; }
.product-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.product-table th, .product-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}
.product-table th { background: #f9fafb; font-weight: 600; font-size: 0.85rem; color: #374151; }
.thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 4px; }
.no-img { color: #d1d5db; }
.empty { color: #9ca3af; }
</style>
```

- [ ] **Step 2: Verify in browser**

Navigate to an existing catalog. Confirm: name appears, link is correct, toggle button works (changes badge), "Copiar link" copies to clipboard, empty products message shows.

- [ ] **Step 3: Commit**

```bash
git add src/views/owner/CatalogDetailView.vue
git commit -m "feat: add catalog detail view"
```

---

## Task 13: Add product view

**Files:**
- Create: `src/views/owner/ProductNewView.vue`

- [ ] **Step 1: Create ProductNewView**

Create `src/views/owner/ProductNewView.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductStore } from '../../stores/products'

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()

const catalogId = route.params.id as string

const reference = ref('')
const name = ref('')
const measurements = ref('')
const quality = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const error = ref('')
const loading = ref(false)

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

async function save() {
  loading.value = true
  error.value = ''
  try {
    await productStore.addProduct(
      catalogId,
      {
        reference: reference.value.trim(),
        name: name.value.trim(),
        measurements: measurements.value.trim(),
        quality: quality.value.trim(),
      },
      imageFile.value ?? undefined
    )
    router.push(`/catalogs/${catalogId}`)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1>Agregar producto</h1>
    <form @submit.prevent="save" class="form">
      <label>Referencia *</label>
      <input v-model="reference" type="text" placeholder="Ej: REF-001" required />

      <label>Nombre *</label>
      <input v-model="name" type="text" placeholder="Ej: Camisa manga larga" required />

      <label>Medidas *</label>
      <input v-model="measurements" type="text" placeholder="Ej: S, M, L, XL" required />

      <label>Calidad *</label>
      <input v-model="quality" type="text" placeholder="Ej: Premium" required />

      <label>Imagen (opcional)</label>
      <input type="file" accept="image/*" @change="onFileChange" style="margin-bottom:0.75rem" />
      <div v-if="imagePreview" class="preview-wrap">
        <img :src="imagePreview" class="preview" alt="Vista previa" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="button" @click="router.back()">Cancelar</button>
        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? 'Guardando...' : 'Guardar producto' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page { max-width: 480px; }
h1 { margin-bottom: 1.5rem; }
.form {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
label { display: block; font-weight: 500; margin-bottom: 0.3rem; font-size: 0.9rem; color: #374151; }
.preview-wrap { margin-bottom: 0.75rem; }
.preview { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
</style>
```

- [ ] **Step 2: Verify in browser**

Navigate to a catalog, click "+ Agregar producto". Fill in all fields, optionally pick an image. Submit. Confirm redirect to catalog detail and the new product appears in the table with its image thumbnail.

- [ ] **Step 3: Commit**

```bash
git add src/views/owner/ProductNewView.vue
git commit -m "feat: add product creation view with image upload"
```

---

## Task 14: ProductTableRow and CartFloat components

**Files:**
- Create: `src/components/public/ProductTableRow.vue`
- Create: `src/components/public/CartFloat.vue`

- [ ] **Step 1: Create components directory**

```bash
mkdir -p src/components/public
```

- [ ] **Step 2: Create ProductTableRow**

Create `src/components/public/ProductTableRow.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '../../types'
import { useCartStore } from '../../stores/cart'

const props = defineProps<{ product: Product }>()
const cart = useCartStore()

const quantity = computed(() => cart.getQuantity(props.product.id))
</script>

<template>
  <tr>
    <td>
      <img v-if="product.image_url" :src="product.image_url" class="thumb" alt="" />
      <span v-else class="no-img">—</span>
    </td>
    <td>{{ product.reference }}</td>
    <td>{{ product.name }}</td>
    <td>{{ product.measurements }}</td>
    <td>{{ product.quality }}</td>
    <td class="qty-cell">
      <div v-if="quantity > 0" class="qty-controls">
        <button class="qty-btn" @click="cart.removeItem(product.id)">−</button>
        <span class="qty-number">{{ quantity }}</span>
        <button class="qty-btn" @click="cart.addItem(product)">+</button>
      </div>
      <button v-else class="add-btn" @click="cart.addItem(product)">+</button>
    </td>
  </tr>
</template>

<style scoped>
.thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 4px; }
.no-img { color: #d1d5db; }
.qty-cell { white-space: nowrap; }
.qty-controls { display: flex; align-items: center; gap: 0.25rem; }
.qty-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qty-number {
  font-size: 1.4rem;
  font-weight: 700;
  min-width: 2rem;
  text-align: center;
  color: #18a34a;
}
.add-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 50%;
  font-size: 1.25rem;
  background: #18a34a;
  color: #fff;
  border-color: #18a34a;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-btn:hover { background: #16923f; }
</style>
```

- [ ] **Step 3: Create CartFloat**

Create `src/components/public/CartFloat.vue`:
```vue
<script setup lang="ts">
import { useCartStore } from '../../stores/cart'

const emit = defineEmits<{ openModal: [] }>()
const cart = useCartStore()
</script>

<template>
  <button
    v-if="cart.totalItems > 0"
    class="cart-float"
    @click="emit('openModal')"
  >
    <span class="cart-badge">{{ cart.totalItems }}</span>
    Ver pedido
  </button>
</template>

<style scoped>
.cart-float {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background: #18a34a;
  color: #fff;
  border: none;
  border-radius: 50px;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(24,163,74,0.4);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 100;
  transition: transform 0.15s;
}
.cart-float:hover { transform: scale(1.04); }
.cart-badge {
  background: #fff;
  color: #18a34a;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 700;
}
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/public/ProductTableRow.vue src/components/public/CartFloat.vue
git commit -m "feat: add ProductTableRow and CartFloat components"
```

---

## Task 15: OrderModal component

**Files:**
- Create: `src/components/public/OrderModal.vue`

- [ ] **Step 1: Create OrderModal**

Create `src/components/public/OrderModal.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore } from '../../stores/cart'
import { supabase } from '../../lib/supabase'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../../lib/whatsapp'
import type { Catalog } from '../../types'

const props = defineProps<{
  catalog: Catalog
  whatsappNumber: string
}>()
const emit = defineEmits<{ close: [] }>()

const cart = useCartStore()
const customerName = ref('')
const customerEmail = ref('')
const customerPhone = ref('')
const loading = ref(false)
const error = ref('')

async function send() {
  loading.value = true
  error.value = ''
  try {
    const { error: dbError } = await supabase.from('orders').insert({
      catalog_id: props.catalog.id,
      customer_name: customerName.value.trim() || null,
      customer_email: customerEmail.value.trim() || null,
      customer_phone: customerPhone.value.trim() || null,
      items: cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
    })
    if (dbError) throw dbError

    const message = buildWhatsAppMessage(props.catalog.name, cart.items, {
      name: customerName.value.trim() || undefined,
      email: customerEmail.value.trim() || undefined,
      phone: customerPhone.value.trim() || undefined,
    })
    const url = buildWhatsAppUrl(props.whatsappNumber, message)

    cart.clear()
    emit('close')
    window.open(url, '_blank')
  } catch {
    error.value = 'No se pudo guardar el pedido. Por favor intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Tu pedido</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="order-items">
        <div v-for="item in cart.items" :key="item.product.id" class="order-item">
          <div class="item-info">
            <span class="item-ref">[{{ item.product.reference }}]</span>
            {{ item.product.name }}
          </div>
          <span class="item-qty">x{{ item.quantity }}</span>
        </div>
      </div>

      <div class="divider" />

      <div class="customer-form">
        <p class="form-label">Tus datos (opcional)</p>
        <input v-model="customerName" type="text" placeholder="Nombre" />
        <input v-model="customerEmail" type="email" placeholder="Correo electrónico" />
        <input v-model="customerPhone" type="tel" placeholder="Teléfono" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button class="whatsapp-btn" :disabled="loading || cart.items.length === 0" @click="send">
        {{ loading ? 'Enviando...' : '📲 Enviar pedido por WhatsApp' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}
@media (min-width: 600px) {
  .overlay { align-items: center; }
}
.modal {
  background: #fff;
  border-radius: 12px 12px 0 0;
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
  max-height: 90vh;
  overflow-y: auto;
}
@media (min-width: 600px) {
  .modal { border-radius: 12px; }
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.modal-header h2 { font-size: 1.2rem; }
.close-btn { background: none; border: none; font-size: 1.1rem; color: #9ca3af; padding: 0; }
.order-items { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}
.item-ref { color: #9ca3af; font-size: 0.85rem; margin-right: 0.25rem; }
.item-qty { font-weight: 700; color: #18a34a; font-size: 1rem; }
.divider { height: 1px; background: #e5e7eb; margin: 1rem 0; }
.customer-form p.form-label { font-weight: 500; font-size: 0.9rem; color: #374151; margin-bottom: 0.75rem; }
.whatsapp-btn {
  width: 100%;
  padding: 0.875rem;
  background: #25d366;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  margin-top: 0.5rem;
}
.whatsapp-btn:hover:not(:disabled) { background: #1ebe5a; }
.whatsapp-btn:disabled { opacity: 0.5; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/public/OrderModal.vue
git commit -m "feat: add OrderModal component with WhatsApp send"
```

---

## Task 16: Public catalog view

**Files:**
- Create: `src/views/public/CatalogPublicView.vue`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/views/public
```

Create `src/views/public/CatalogPublicView.vue`:
```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import ProductTableRow from '../../components/public/ProductTableRow.vue'
import CartFloat from '../../components/public/CartFloat.vue'
import OrderModal from '../../components/public/OrderModal.vue'
import type { Catalog } from '../../types'

const route = useRoute()
const catalogStore = useCatalogStore()
const productStore = useProductStore()

const catalog = ref<Catalog | null>(null)
const loading = ref(true)
const showModal = ref(false)

onMounted(async () => {
  const slug = route.params.slug as string
  catalog.value = await catalogStore.fetchBySlug(slug)

  if (catalog.value) {
    await productStore.fetchByCatalog(catalog.value.id)
  }

  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="state">Cargando catálogo...</div>

  <div v-else-if="!catalog" class="state inactive">
    <h2>Catálogo no disponible</h2>
    <p>Este catálogo no existe o ya no está activo.</p>
  </div>

  <div v-else class="catalog-page">
    <h1 class="catalog-title">{{ catalog.name }}</h1>

    <div class="table-wrap">
      <table class="product-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Referencia</th>
            <th>Nombre</th>
            <th>Medidas</th>
            <th>Calidad</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          <ProductTableRow
            v-for="product in productStore.products"
            :key="product.id"
            :product="product"
          />
        </tbody>
      </table>
    </div>

    <p v-if="productStore.products.length === 0" class="empty">
      Este catálogo no tiene productos todavía.
    </p>

    <CartFloat @open-modal="showModal = true" />

    <OrderModal
      v-if="showModal"
      :catalog="catalog"
      :whatsapp-number="catalog.whatsapp_number || ''"
      @close="showModal = false"
    />
  </div>
</template>

<style scoped>
.state { text-align: center; margin-top: 4rem; color: #6b7280; }
.state h2 { margin-bottom: 0.5rem; font-size: 1.3rem; }
.catalog-page { padding-bottom: 6rem; }
.catalog-title { font-size: 1.75rem; margin-bottom: 1.5rem; }
.table-wrap { overflow-x: auto; }
.product-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.product-table th, .product-table :deep(td) {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}
.product-table th { background: #f9fafb; font-weight: 600; font-size: 0.85rem; color: #374151; }
.empty { color: #9ca3af; margin-top: 2rem; text-align: center; }
</style>
```

- [ ] **Step 2: Verify full end-to-end flow in browser**

1. As owner: sign in, create a catalog, add 2-3 products (at least one with an image).
2. Copy the catalog link and open it in a new incognito window (or different browser).
3. Confirm: product table shows all products with images.
4. Click `+` on a product — confirm the quantity counter appears in green.
5. Add more products — confirm the floating button shows the total.
6. Click "Ver pedido" — confirm the modal opens with the order summary.
7. Optionally fill in a name/phone, click "Enviar por WhatsApp".
8. Confirm: WhatsApp opens with the correct message and phone number.
9. Go back and confirm the order was saved in Supabase (dashboard → Table Editor → orders).

- [ ] **Step 3: Test inactive catalog**

In the Supabase dashboard, set a catalog's `is_active` to `false`. Open its link. Confirm you see "Catálogo no disponible".

- [ ] **Step 4: Commit**

```bash
git add src/views/public/CatalogPublicView.vue
git commit -m "feat: add public catalog view with cart and order flow"
```

---

## Task 17: Final check and clean up

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 2: Run type check**

```bash
npm run type-check
```

Expected: No TypeScript errors.

- [ ] **Step 3: Run dev server and do full end-to-end test**

```bash
npm run dev
```

Go through the full flow once more:
- Sign up → create catalog → add products → share link → customer orders → WhatsApp opens.

- [ ] **Step 4: Final commit if anything was fixed**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
