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
