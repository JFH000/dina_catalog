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
  if (!order.value?.odoo_invoice_id || !import.meta.env.VITE_ODOO_URL) return null
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
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'No se pudo aceptar el pedido. Intenta de nuevo.'
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
