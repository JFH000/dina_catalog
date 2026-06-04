<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useProductStore } from '../../stores/products'
import { useCartStore } from '../../stores/cart'
import ProductCard from '../../components/public/ProductCard.vue'
import CartFloat from '../../components/public/CartFloat.vue'
import OrderModal from '../../components/public/OrderModal.vue'
import type { Catalog } from '../../types'

const route = useRoute()
const catalogStore = useCatalogStore()
const productStore = useProductStore()
const cart = useCartStore()

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
    cart.loadForCatalog(catalog.value.id)
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
  gap: 0.6rem;
  grid-template-columns: repeat(3, 1fr);
}
@media (min-width: 768px) {
  .product-grid { gap: 1rem; grid-template-columns: repeat(4, 1fr); }
}
.empty { color: #9ca3af; margin-top: 2rem; text-align: center; }
</style>
