<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Product } from '../../types'
import { useCartStore } from '../../stores/cart'

const props = defineProps<{ product: Product }>()
const cart = useCartStore()

const quantity = computed(() => cart.getQuantity(props.product.id))
const showDetail = ref(false)

const BLANK = /^[-–—/\\.\s]*(n\/?a|none|nan|null|–|—|-)?[-–—/\\.\s]*$/i
function visible(val: string | null | undefined): string | null {
  if (val == null) return null
  const s = val.trim()
  if (!s || BLANK.test(s)) return null
  return s
}

const refText  = computed(() => visible(props.product.reference))
const nameText = computed(() => visible(props.product.name))
const measText = computed(() => visible(props.product.measurements))
const qualText = computed(() => visible(props.product.quality))
</script>

<template>
  <div class="product-card">
    <!-- tap image to open detail -->
    <div class="card-image" @click="showDetail = true" @contextmenu.prevent>
      <img
        v-if="product.image_url"
        :src="product.image_url"
        :alt="product.name"
        class="card-img"
        draggable="false"
      />
      <div v-else class="card-placeholder">—</div>

      <span v-if="quantity > 0" class="qty-badge">{{ quantity }}</span>

      <button
        v-if="quantity > 0"
        class="btn-remove"
        @click.stop="cart.removeItem(product.id)"
      >−</button>

      <button
        class="btn-add"
        @click.stop="cart.addItem(product)"
      >+</button>
    </div>

    <div class="card-info">
      <p v-if="refText"  class="info-ref">Ref. {{ refText }}</p>
      <p v-if="nameText" class="info-name">{{ nameText }}</p>
      <p v-if="measText" class="info-meas">{{ measText }}</p>
      <p v-if="qualText" class="info-qual">{{ qualText }}</p>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="showDetail" class="pdl-overlay" @click.self="showDetail = false">
      <div class="pdl-modal">
        <button class="pdl-close" @click="showDetail = false">✕</button>
        <div class="pdl-image-wrap">
          <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="pdl-img" />
          <div v-else class="pdl-no-img">—</div>
        </div>
        <div class="pdl-info">
          <p v-if="visible(product.reference)"    class="pdl-ref">{{ visible(product.reference) }}</p>
          <p v-if="visible(product.name)"         class="pdl-name">{{ visible(product.name) }}</p>
          <p v-if="visible(product.measurements)" class="pdl-field">{{ visible(product.measurements) }}</p>
          <p v-if="visible(product.quality)"      class="pdl-field">{{ visible(product.quality) }}</p>
        </div>
        <div class="pdl-qty">
          <div v-if="quantity > 0" class="pdl-controls">
            <button class="pdl-btn" @click="cart.removeItem(product.id)">−</button>
            <span class="pdl-number">{{ quantity }}</span>
            <button class="pdl-btn pdl-btn-add" @click="cart.addItem(product)">+</button>
          </div>
          <button v-else class="pdl-add-btn" @click="cart.addItem(product)">Agregar al pedido</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.product-card {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 5px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  -webkit-touch-callout: none;
  user-select: none;
}

.card-image {
  position: relative;
  aspect-ratio: 1 / 1;
  background: #f3f4f6;
  flex-shrink: 0;
  cursor: pointer;
}
.card-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}
.card-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  font-size: 2rem;
}

.qty-badge {
  position: absolute;
  top: 5px;
  right: 7px;
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  color: #16a34a;
  text-shadow: 0 1px 4px rgba(255,255,255,0.7);
  pointer-events: none;
}

/* Use .card-image prefix to beat the global button:hover specificity */
.card-image .btn-remove,
.card-image .btn-add {
  position: absolute;
  bottom: 7px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  font-size: 1.1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.22);
  transition: opacity 0.1s;
}
.card-image .btn-remove,
.card-image .btn-remove:hover { left: 7px;  background: #ef4444; color: #fff; }
.card-image .btn-add,
.card-image .btn-add:hover    { right: 7px; background: #16a34a; color: #fff; }
.card-image .btn-remove:active { opacity: 0.8; }
.card-image .btn-add:active    { opacity: 0.8; }

.card-info {
  padding: 0.4rem 0.45rem 0.45rem;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}
.info-ref,
.info-name,
.info-meas,
.info-qual {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}
.info-ref  { font-size: 0.6rem;  color: #9ca3af; }
.info-name { font-size: 0.65rem; font-weight: 600; color: #1a1a1a; }
.info-meas { font-size: 0.6rem;  color: #6b7280; }
.info-qual { font-size: 0.6rem;  color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
</style>

<style>
.pdl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 1.5rem;
}
.pdl-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  position: relative;
}
.pdl-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.08);
  border: none;
  font-size: 0.9rem;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  cursor: pointer;
}
.pdl-image-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f9fafb;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  flex-shrink: 0;
}
.pdl-img { width: 100%; height: 100%; object-fit: contain; }
.pdl-no-img {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  font-size: 3rem;
}
.pdl-info {
  padding: 1rem 1.25rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.pdl-ref   { font-size: 0.8rem;  color: #9ca3af; margin: 0; }
.pdl-name  { font-size: 1.05rem; font-weight: 600; color: #111; margin: 0; }
.pdl-field { font-size: 0.9rem;  color: #6b7280; margin: 0; }
.pdl-qty {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  justify-content: center;
}
.pdl-controls { display: flex; align-items: center; gap: 0.5rem; }
.pdl-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  padding: 0;
}
.pdl-btn-add { background: #16a34a; border-color: #16a34a; color: #fff; }
.pdl-btn-add:hover { background: #15803d; }
.pdl-number {
  font-size: 1.75rem;
  font-weight: 700;
  min-width: 3rem;
  text-align: center;
  color: #16a34a;
}
.pdl-add-btn {
  width: 100%;
  padding: 0.875rem;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.pdl-add-btn:hover { background: #15803d; }
</style>
