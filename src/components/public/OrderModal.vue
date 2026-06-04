<script setup lang="ts">
import { ref } from 'vue'
import { useCartStore } from '../../stores/cart'
import { supabase } from '../../lib/supabase'
import { buildWhatsAppMessage, buildWhatsAppUrl, productLabel } from '../../lib/whatsapp'
import type { Catalog } from '../../types'

const props = defineProps<{
  catalog: Catalog
  whatsappNumber: string
}>()
const emit = defineEmits<{ close: [] }>()

const cart = useCartStore()
const customerName = ref('')

function confirmClear() {
  if (confirm('¿Eliminar todos los productos del pedido?')) {
    cart.clear()
    emit('close')
  }
}
const customerEmail = ref('')
const customerPhone = ref('')
const loading = ref(false)
const error = ref('')

async function send() {
  if (!props.whatsappNumber) {
    error.value = 'Este catálogo no tiene número de WhatsApp configurado.'
    return
  }
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

    window.open(url, '_blank')
    cart.clear()
    emit('close')
  } catch {
    error.value = 'No se pudo guardar el pedido. Por favor intenta de nuevo.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="!loading && emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Tu pedido</h2>
        <button class="close-btn" :disabled="loading" @click="!loading && emit('close')">✕</button>
      </div>

      <div class="order-items-header">
        <span class="items-count">{{ cart.items.length }} producto{{ cart.items.length !== 1 ? 's' : '' }}</span>
        <button class="clear-all-btn" @click="confirmClear">Borrar todo</button>
      </div>

      <div class="order-items">
        <div v-for="item in cart.items" :key="item.product.id" class="order-item">
          <div class="item-info">{{ productLabel(item.product) }}</div>
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
.order-items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.items-count { font-size: 0.85rem; color: #6b7280; }
.clear-all-btn {
  font-size: 0.8rem;
  color: #dc2626;
  border-color: transparent;
  background: none;
  padding: 0.25rem 0.5rem;
}
.clear-all-btn:hover { background: #fef2f2; border-color: transparent; }
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
