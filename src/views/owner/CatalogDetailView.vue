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

async function toggle() {
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
