<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import ProductModal from '../../components/owner/ProductModal.vue'
import type { Catalog, Product } from '../../types'
import { parseCatalogCsv } from '../../lib/csv'

const route = useRoute()
const router = useRouter()
const catalogStore = useCatalogStore()
const productStore = useProductStore()

const catalog = ref<Catalog | null>(null)
const loading = ref(true)
const showModal = ref(false)
const selectedProduct = ref<Product | undefined>(undefined)
const csvInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importMessage = ref('')
const importError = ref(false)
const linkCopied = ref(false)
const searchQuery = ref('')

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return productStore.products
  return productStore.products.filter(p =>
    p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
  )
})

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
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
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

async function onCsvChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  importMessage.value = ''
  importError.value = false
  importing.value = true
  try {
    const text = await file.text()
    const rows = parseCatalogCsv(text)
    if (rows.length === 0) {
      importMessage.value = 'El CSV no tiene filas'
      importError.value = true
      return
    }
    const count = await productStore.importProducts(catalog.value!.id, rows)
    importMessage.value = `${count} producto${count !== 1 ? 's' : ''} importado${count !== 1 ? 's' : ''}`
  } catch (e: any) {
    importMessage.value = e.message
    importError.value = true
  } finally {
    importing.value = false
    if (csvInput.value) csvInput.value.value = ''
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
        <input ref="csvInput" type="file" accept=".csv" style="display:none" @change="onCsvChange" />
        <button :disabled="importing" @click="csvInput?.click()">
          {{ importing ? 'Importando...' : 'Importar CSV' }}
        </button>
        <button class="primary" @click="openCreate">+ Agregar producto</button>
      </div>
    </div>

    <div class="link-box">
      <span class="badge" :class="catalog.is_active ? 'active' : 'inactive'">
        {{ catalog.is_active ? 'Activo' : 'Inactivo' }}
      </span>
      <code>{{ publicLink }}</code>
      <button @click="copyLink" :class="{ copied: linkCopied }">
        {{ linkCopied ? '✓ Copiado' : 'Copiar link' }}
      </button>
    </div>

    <div class="products-section">
      <h2>Productos ({{ productStore.products.length }})</h2>
      <p v-if="importMessage" :class="importError ? 'error' : 'import-msg'">{{ importMessage }}</p>
      <p v-if="productStore.products.length === 0" class="empty">
        Aún no hay productos. ¡Agrega el primero!
      </p>
      <template v-else>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Buscar por nombre o referencia..."
        />
        <p v-if="filteredProducts.length === 0" class="empty">
          Sin resultados para "{{ searchQuery }}"
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
            v-for="product in filteredProducts"
            :key="product.id"
            :class="{ inactive: !product.is_active }"
          >
            <td data-label="Imagen">
              <img v-if="product.image_url" :src="product.image_url" class="thumb" alt="" />
              <span v-else class="no-img">—</span>
            </td>
            <td data-label="Referencia">{{ product.reference }}</td>
            <td data-label="Nombre">{{ product.name }}</td>
            <td data-label="Medidas">{{ product.measurements }}</td>
            <td data-label="Calidad">{{ product.quality }}</td>
            <td data-label="Acciones" class="actions-cell">
              <button @click="openEdit(product)">Editar</button>
              <button @click="toggleProduct(product)">
                {{ product.is_active ? 'Desactivar' : 'Activar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </template>
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
  gap: 1rem;
}
.back { font-size: 0.85rem; color: #6b7280; text-decoration: none; display: block; margin-bottom: 0.25rem; }
.back:hover { color: #18a34a; }
h1 { font-size: 1.5rem; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; justify-content: flex-end; padding-top: 1.5rem; }
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
code { flex: 1; min-width: 0; font-size: 0.8rem; color: #555; word-break: break-all; }
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
.search-input { margin-bottom: 1rem; }
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
.import-msg { margin-bottom: 0.75rem; color: #166534; font-size: 0.9rem; }
tr.inactive { opacity: 0.45; }
.actions-cell { display: flex; gap: 0.4rem; white-space: nowrap; }
button.copied { background: #dcfce7; color: #166534; border-color: #86efac; transition: background 0.2s; }

@media (max-width: 600px) {
  .header { flex-direction: column; }
  .header-actions { padding-top: 0; justify-content: flex-start; width: 100%; }
  .header-actions button { flex: 1; }

  .product-table thead { display: none; }
  .product-table, .product-table tbody, .product-table tr, .product-table td { display: block; width: 100%; }
  .product-table tr {
    border-bottom: 1px solid #e5e7eb;
    padding: 0.75rem 0;
    display: grid;
    grid-template-columns: 56px 1fr;
    grid-template-rows: auto auto auto;
    gap: 0.15rem 0.75rem;
  }
  .product-table td { padding: 0; border: none; font-size: 0.85rem; }
  .product-table td[data-label="Imagen"] {
    grid-row: 1 / 4;
    grid-column: 1;
    display: flex;
    align-items: center;
  }
  .product-table td[data-label="Referencia"] { grid-column: 2; font-weight: 600; color: #374151; }
  .product-table td[data-label="Nombre"] { grid-column: 2; color: #555; }
  .product-table td[data-label="Medidas"],
  .product-table td[data-label="Calidad"] { grid-column: 2; color: #9ca3af; font-size: 0.8rem; }
  .product-table td[data-label="Acciones"] {
    grid-column: 1 / 3;
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
  }
  .product-table td[data-label="Acciones"] button { flex: 1; }
  .thumb { width: 48px; height: 48px; }
}
</style>
