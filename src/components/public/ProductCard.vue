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

const line1 = computed(() => {
  const parts = [visible(props.product.reference), visible(props.product.name)].filter(Boolean)
  return parts.join(' · ')
})

const line2 = computed(() => {
  const parts = [visible(props.product.measurements), visible(props.product.quality)].filter(Boolean)
  return parts.join(' · ')
})

// Long press detection
let pressTimer: number | null = null
let touchMoved = false

function onTouchStart() {
  touchMoved = false
  pressTimer = window.setTimeout(() => {
    if (!touchMoved) showDetail.value = true
  }, 500)
}

function onTouchEnd() {
  if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null }
}

function onTouchMove() {
  touchMoved = true
  if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null }
}
</script>

<template>
  <div class="product-card">
    <div
      class="card-image-wrap"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @touchmove.passive="onTouchMove"
      @contextmenu.prevent
    >
      <img
        v-if="product.image_url"
        :src="product.image_url"
        :alt="product.name"
        class="card-img"
        draggable="false"
      />
      <div v-else class="card-img-placeholder">—</div>
      <div v-if="line1 || line2" class="card-overlay">
        <p v-if="line1" class="overlay-line1">{{ line1 }}</p>
        <p v-if="line2" class="overlay-line2">{{ line2 }}</p>
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

  <Teleport to="body">
    <div v-if="showDetail" class="pdl-overlay" @click.self="showDetail = false">
      <div class="pdl-modal">
        <button class="pdl-close" @click="showDetail = false">✕</button>
        <div class="pdl-image-wrap">
          <img
            v-if="product.image_url"
            :src="product.image_url"
            :alt="product.name"
            class="pdl-img"
          />
          <div v-else class="pdl-no-img">—</div>
        </div>
        <div class="pdl-info">
          <p v-if="visible(product.reference)" class="pdl-ref">{{ visible(product.reference) }}</p>
          <p v-if="visible(product.name)" class="pdl-name">{{ visible(product.name) }}</p>
          <p v-if="visible(product.measurements)" class="pdl-field">{{ visible(product.measurements) }}</p>
          <p v-if="visible(product.quality)" class="pdl-field">{{ visible(product.quality) }}</p>
        </div>
        <div class="pdl-qty">
          <div v-if="quantity > 0" class="pdl-controls">
            <button class="pdl-btn" @click="cart.removeItem(product.id)">−</button>
            <span class="pdl-number">{{ quantity }}</span>
            <button class="pdl-btn" @click="cart.addItem(product)">+</button>
          </div>
          <button v-else class="pdl-add-btn" @click="cart.addItem(product)">Agregar al pedido</button>
        </div>
      </div>
    </div>
  </Teleport>
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
  -webkit-touch-callout: none;
  user-select: none;
}
.card-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
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
  margin: 0;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
.overlay-line1 {
  font-weight: 600;
  -webkit-line-clamp: 2;
}
.overlay-line2 {
  -webkit-line-clamp: 2;
}
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

<style>
.pdl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
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
}
.pdl-image-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f9fafb;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  flex-shrink: 0;
}
.pdl-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
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
.pdl-ref {
  font-size: 0.8rem;
  color: #9ca3af;
  margin: 0;
}
.pdl-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #111;
  margin: 0;
}
.pdl-field {
  font-size: 0.9rem;
  color: #6b7280;
  margin: 0;
}
.pdl-qty {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  justify-content: center;
}
.pdl-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
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
}
.pdl-number {
  font-size: 1.75rem;
  font-weight: 700;
  min-width: 3rem;
  text-align: center;
  color: #18a34a;
}
.pdl-add-btn {
  width: 100%;
  padding: 0.875rem;
  background: #18a34a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.pdl-add-btn:hover { background: #16923f; }
</style>
