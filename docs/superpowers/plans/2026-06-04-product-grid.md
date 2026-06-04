# Product Grid View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the product table in the public catalog view with a responsive card grid where each card shows a dominant image with an info overlay and quantity controls below.

**Architecture:** New `ProductCard.vue` component handles one card. `CatalogPublicView.vue` switches from `<table>` to CSS grid, filters out inactive products, and imports `ProductCard` instead of `ProductTableRow`. `ProductTableRow.vue` is deleted.

**Tech Stack:** Vue 3, TypeScript, CSS Grid

---

## File Map

| Action | File |
|--------|------|
| Create | `src/components/public/ProductCard.vue` |
| Modify | `src/views/public/CatalogPublicView.vue` |
| Delete | `src/components/public/ProductTableRow.vue` |

---

## Task 1: Create ProductCard component

**Files:**
- Create: `src/components/public/ProductCard.vue`

- [ ] **Step 1: Create the file**

Create `src/components/public/ProductCard.vue`:

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
  <div class="product-card">
    <div class="card-image-wrap">
      <img
        v-if="product.image_url"
        :src="product.image_url"
        :alt="product.name"
        class="card-img"
      />
      <div v-else class="card-img-placeholder">—</div>
      <div class="card-overlay">
        <p class="overlay-line1">{{ product.reference }} · {{ product.name }}</p>
        <p class="overlay-line2">{{ product.measurements }} · {{ product.quality }}</p>
      </div>
    </div>
    <div class="card-qty">
      <div v-if="quantity > 0" class="qty-controls">
        <button class="qty-btn" @click="cart.removeItem(product.id)">−</button>
        <span class="qty-number">{{ quantity }}</span>
        <button class="qty-btn" @click="cart.addItem(product)">+</button>
      </div>
      <button v-else class="add-btn" @click="cart.addItem(product)">+</button>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  display: flex;
  flex-direction: column;
}
.card-image-wrap {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 6px rgba(0,0,0,0.1);
}
.card-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.card-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  color: #d1d5db;
  font-size: 1.5rem;
}
.card-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.55);
  padding: 0.4rem 0.6rem;
}
.overlay-line1,
.overlay-line2 {
  color: #fff;
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  line-height: 1.4;
}
.overlay-line1 { font-weight: 600; }
.card-qty {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.4rem 0;
  min-height: 2.5rem;
}
.qty-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.qty-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  font-size: 1rem;
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

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: All 33 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/ProductCard.vue
git commit -m "feat: add ProductCard component with image overlay and quantity controls"
```

---

## Task 2: Update CatalogPublicView and delete ProductTableRow

**Files:**
- Modify: `src/views/public/CatalogPublicView.vue`
- Delete: `src/components/public/ProductTableRow.vue`

- [ ] **Step 1: Replace CatalogPublicView entirely**

Write `src/views/public/CatalogPublicView.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import ProductCard from '../../components/public/ProductCard.vue'
import CartFloat from '../../components/public/CartFloat.vue'
import OrderModal from '../../components/public/OrderModal.vue'
import type { Catalog } from '../../types'

const route = useRoute()
const catalogStore = useCatalogStore()
const productStore = useProductStore()

const catalog = ref<Catalog | null>(null)
const loading = ref(true)
const showModal = ref(false)

const activeProducts = computed(() =>
  productStore.products.filter(p => p.is_active)
)

onMounted(async () => {
  const slug = route.params.slug as string
  try {
    catalog.value = await catalogStore.fetchBySlug(slug)
  } catch {
    catalog.value = null
  }
  if (catalog.value) {
    try {
      await productStore.fetchByCatalog(catalog.value.id)
    } catch {
      // products failed — show catalog with empty product list
    }
  }
  loading.value = false
})
</script>

<template>
  <div v-if="loading" class="state">Cargando catálogo...</div>

  <div v-else-if="!catalog" class="state">
    <h2>Catálogo no disponible</h2>
    <p>Este catálogo no existe o ya no está activo.</p>
  </div>

  <div v-else class="catalog-page">
    <h1 class="catalog-title">{{ catalog.name }}</h1>

    <p v-if="activeProducts.length === 0" class="empty">
      Este catálogo no tiene productos todavía.
    </p>

    <div v-else class="product-grid">
      <ProductCard
        v-for="product in activeProducts"
        :key="product.id"
        :product="product"
      />
    </div>

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
.product-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, 1fr);
}
@media (min-width: 480px) {
  .product-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 768px) {
  .product-grid { grid-template-columns: repeat(4, 1fr); }
}
.empty { color: #9ca3af; margin-top: 2rem; text-align: center; }
</style>
```

- [ ] **Step 2: Delete ProductTableRow**

On Windows PowerShell:
```powershell
Remove-Item src/components/public/ProductTableRow.vue
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: All 33 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/public/CatalogPublicView.vue
git rm src/components/public/ProductTableRow.vue
git commit -m "feat: replace product table with responsive card grid, filter inactive products"
```
