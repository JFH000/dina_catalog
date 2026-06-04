# Product Edit & Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the product creation page with a modal, add inline edit via the same modal, and add per-product active/inactive toggle.

**Architecture:** Single `ProductModal` component handles create and edit. `CatalogDetailView` manages modal state and passes the selected product (or undefined for create). Two new store methods handle update and toggle. ProductNewView and its route are removed.

**Tech Stack:** Vue 3, TypeScript, Pinia, Supabase JS v2

---

## File Map

### Files to create
- `src/components/owner/ProductModal.vue` — single modal for create + edit

### Files to modify
- `src/types/index.ts` — add `is_active: boolean` to `Product`
- `src/stores/products.ts` — add `updateProduct`, `toggleProductActive`
- `src/views/owner/CatalogDetailView.vue` — use modal, per-row edit/toggle buttons
- `src/router/index.ts` — remove `/catalogs/:id/products/new` route

### Files to delete
- `src/views/owner/ProductNewView.vue`

---

## Task 1: Database migration + type update

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Run SQL in Supabase dashboard**

Go to Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
alter table public.products add column is_active boolean default true not null;
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Update Product interface**

In `src/types/index.ts`, replace the `Product` interface:

```typescript
export interface Product {
  id: string
  catalog_id: string
  reference: string
  name: string
  measurements: string
  quality: string
  image_url: string | null
  is_active: boolean
  created_at: string
}
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npx vitest run
```

Expected: 24 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add is_active field to Product type"
```

---

## Task 2: Update products store

**Files:**
- Modify: `src/stores/products.ts`

- [ ] **Step 1: Replace the entire file with the updated version**

Write `src/stores/products.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])

  async function fetchByCatalog(catalogId: string) {
    products.value = []
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
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
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

  async function updateProduct(
    id: string,
    fields: { reference: string; name: string; measurements: string; quality: string },
    imageFile?: File
  ): Promise<void> {
    const updateData: Partial<Product> = { ...fields }

    if (imageFile) {
      const existing = products.value.find(p => p.id === id)
      const catalogId = existing?.catalog_id ?? 'unknown'
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${catalogId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)
      updateData.image_url = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    const idx = products.value.findIndex(p => p.id === id)
    if (idx !== -1) products.value[idx] = data
  }

  async function toggleProductActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw error
    const product = products.value.find(p => p.id === id)
    if (product) product.is_active = isActive
  }

  return { products, fetchByCatalog, addProduct, updateProduct, toggleProductActive }
})
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: 24 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/stores/products.ts
git commit -m "feat: add updateProduct and toggleProductActive to products store"
```

---

## Task 3: Create ProductModal component

**Files:**
- Create: `src/components/owner/ProductModal.vue`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/components/owner
```

- [ ] **Step 2: Create `src/components/owner/ProductModal.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Product } from '../../types'
import { useProductStore } from '../../stores/products'

const props = defineProps<{
  product?: Product
  catalogId: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const productStore = useProductStore()

const reference = ref('')
const name = ref('')
const measurements = ref('')
const quality = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const loading = ref(false)
const error = ref('')

const isEdit = computed(() => !!props.product)

watch(
  () => props.product,
  (p) => {
    reference.value = p?.reference ?? ''
    name.value = p?.name ?? ''
    measurements.value = p?.measurements ?? ''
    quality.value = p?.quality ?? ''
    imageFile.value = null
    imagePreview.value = p?.image_url ?? ''
    error.value = ''
  },
  { immediate: true }
)

let currentBlobUrl = ''

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
  imageFile.value = file
  currentBlobUrl = URL.createObjectURL(file)
  imagePreview.value = currentBlobUrl
}

onUnmounted(() => {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
})

async function save() {
  loading.value = true
  error.value = ''
  try {
    const fields = {
      reference: reference.value.trim(),
      name: name.value.trim(),
      measurements: measurements.value.trim(),
      quality: quality.value.trim(),
    }
    if (props.product) {
      await productStore.updateProduct(props.product.id, fields, imageFile.value ?? undefined)
    } else {
      await productStore.addProduct(props.catalogId, fields, imageFile.value ?? undefined)
    }
    emit('saved')
    emit('close')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="!loading && emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ isEdit ? 'Editar producto' : 'Nuevo producto' }}</h2>
        <button class="close-btn" :disabled="loading" @click="!loading && emit('close')">✕</button>
      </div>

      <form @submit.prevent="save">
        <label>Referencia *</label>
        <input v-model="reference" type="text" placeholder="Ej: REF-001" required />

        <label>Nombre *</label>
        <input v-model="name" type="text" placeholder="Ej: Camisa manga larga" required />

        <label>Medidas *</label>
        <input v-model="measurements" type="text" placeholder="Ej: S, M, L, XL" required />

        <label>Calidad *</label>
        <input v-model="quality" type="text" placeholder="Ej: Premium" required />

        <label>Imagen (opcional)</label>
        <input type="file" accept="image/*" @change="onFileChange" class="file-input" />
        <div v-if="imagePreview" class="preview-wrap">
          <img :src="imagePreview" class="preview" alt="Vista previa" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="actions">
          <button type="button" :disabled="loading" @click="!loading && emit('close')">
            Cancelar
          </button>
          <button type="submit" class="primary" :disabled="loading">
            {{ loading ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear producto') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.modal {
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.modal-header h2 { font-size: 1.15rem; }
.close-btn { background: none; border: none; font-size: 1.1rem; color: #9ca3af; padding: 0; cursor: pointer; }
label { display: block; font-weight: 500; margin-bottom: 0.3rem; font-size: 0.9rem; color: #374151; }
.file-input { margin-bottom: 0.75rem; }
.preview-wrap { margin-bottom: 0.75rem; }
.preview { width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
</style>
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: 24 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/owner/ProductModal.vue
git commit -m "feat: add ProductModal component for create and edit"
```

---

## Task 4: Update CatalogDetailView

**Files:**
- Modify: `src/views/owner/CatalogDetailView.vue`

- [ ] **Step 1: Replace the entire file**

Write `src/views/owner/CatalogDetailView.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import ProductModal from '../../components/owner/ProductModal.vue'
import type { Catalog, Product } from '../../types'

const route = useRoute()
const router = useRouter()
const catalogStore = useCatalogStore()
const productStore = useProductStore()

const catalog = ref<Catalog | null>(null)
const loading = ref(true)
const showModal = ref(false)
const selectedProduct = ref<Product | undefined>(undefined)

const publicLink = computed(() =>
  catalog.value ? `${window.location.origin}/c/${catalog.value.slug}` : ''
)

onMounted(async () => {
  try {
    const id = route.params.id as string
    let found = catalogStore.catalogs.find(c => c.id === id)
    if (!found) {
      await catalogStore.fetchMyCatalogs()
      found = catalogStore.catalogs.find(c => c.id === id)
    }
    catalog.value = found ?? null
    if (catalog.value) await productStore.fetchByCatalog(id)
  } catch {
    catalog.value = null
  } finally {
    loading.value = false
  }
})

async function toggleCatalog() {
  if (!catalog.value) return
  const next = !catalog.value.is_active
  try {
    await catalogStore.toggleActive(catalog.value.id, next)
    catalog.value.is_active = next
  } catch {
    // leave state unchanged on failure
  }
}

function copyLink() {
  navigator.clipboard.writeText(publicLink.value)
}

function openCreate() {
  selectedProduct.value = undefined
  showModal.value = true
}

function openEdit(product: Product) {
  selectedProduct.value = product
  showModal.value = true
}

async function toggleProduct(product: Product) {
  try {
    await productStore.toggleProductActive(product.id, !product.is_active)
  } catch {
    // leave state unchanged on failure
  }
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
        <button @click="toggleCatalog">
          {{ catalog.is_active ? 'Desactivar' : 'Activar' }}
        </button>
        <button class="primary" @click="openCreate">+ Agregar producto</button>
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
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in productStore.products"
            :key="product.id"
            :class="{ inactive: !product.is_active }"
          >
            <td>
              <img v-if="product.image_url" :src="product.image_url" class="thumb" alt="" />
              <span v-else class="no-img">—</span>
            </td>
            <td>{{ product.reference }}</td>
            <td>{{ product.name }}</td>
            <td>{{ product.measurements }}</td>
            <td>{{ product.quality }}</td>
            <td class="actions-cell">
              <button @click="openEdit(product)">Editar</button>
              <button @click="toggleProduct(product)">
                {{ product.is_active ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ProductModal
      v-if="showModal && catalog"
      :product="selectedProduct"
      :catalog-id="catalog.id"
      @close="showModal = false"
      @saved="showModal = false"
    />
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
tr.inactive { opacity: 0.45; }
.actions-cell { display: flex; gap: 0.4rem; white-space: nowrap; }
</style>
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: 24 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/views/owner/CatalogDetailView.vue
git commit -m "feat: replace product page link with modal, add edit and toggle per product"
```

---

## Task 5: Remove ProductNewView and its route

**Files:**
- Modify: `src/router/index.ts`
- Delete: `src/views/owner/ProductNewView.vue`

- [ ] **Step 1: Remove the route from router/index.ts**

In `src/router/index.ts`, remove this block:

```typescript
    {
      path: '/catalogs/:id/products/new',
      component: () => import('../views/owner/ProductNewView.vue'),
      meta: { requiresAuth: true },
    },
```

- [ ] **Step 2: Delete the view file**

```bash
rm src/views/owner/ProductNewView.vue
```

(On Windows PowerShell: `Remove-Item src/views/owner/ProductNewView.vue`)

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: 24 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts
git rm src/views/owner/ProductNewView.vue
git commit -m "chore: remove ProductNewView and its route (replaced by modal)"
```
