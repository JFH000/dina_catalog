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
  <div
    class="product-card"
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
    <div v-else class="card-placeholder">—</div>

    <div class="card-bottom">
      <div class="card-text">
        <span v-if="refText"  class="text-ref">{{ refText }}</span>
        <span v-if="nameText" class="text-name">{{ nameText }}</span>
      </div>

      <div class="card-qty">
        <template v-if="quantity > 0">
          <button class="btn-minus" @click.stop="cart.removeItem(product.id)">−</button>
          <span class="qty-count">{{ quantity }}</span>
          <button class="btn-plus"  @click.stop="cart.addItem(product)">+</button>
        </template>
        <button v-else class="btn-add" @click.stop="cart.addItem(product)">+</button>
      </div>
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
          <p v-if="visible(product.reference)"   class="pdl-ref">{{ visible(product.reference) }}</p>
          <p v-if="visible(product.name)"        class="pdl-name">{{ visible(product.name) }}</p>
          <p v-if="visible(product.measurements)" class="pdl-field">{{ visible(product.measurements) }}</p>
          <p v-if="visible(product.quality)"     class="pdl-field">{{ visible(product.quality) }}</p>
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
  position: relative;
  aspect-ratio: 3 / 4;
  background: #f3f4f6;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 5px rgba(0,0,0,0.1);
  -webkit-touch-callout: none;
  user-select: none;
}

.card-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.card-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
  font-size: 2rem;
}

/* gradient strip at the bottom */
.card-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 55%, transparent 100%);
  padding: 1.4rem 0.45rem 0.45rem;
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
}

.card-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.text-ref,
.text-name {
  display: block;
  color: #fff;
  font-size: 0.6rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-ref  { font-weight: 700; }
.text-name { opacity: 0.85; }

/* quantity controls */
.card-qty {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.18rem;
}

.btn-add {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #18a34a;
  border: none;
  color: #fff;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.btn-add:active { background: #16923f; }

.btn-minus,
.btn-plus {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 0.85rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.btn-minus {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.45);
  color: #fff;
}
.btn-plus {
  background: #18a34a;
  border: none;
  color: #fff;
}
.btn-minus:active { background: rgba(255,255,255,0.35); }
.btn-plus:active  { background: #16923f; }

.qty-count {
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  min-width: 0.9rem;
  text-align: center;
  line-height: 1;
}
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
.pdl-ref   { font-size: 0.8rem;  color: #9ca3af; margin: 0; }
.pdl-name  { font-size: 1.05rem; font-weight: 600; color: #111; margin: 0; }
.pdl-field { font-size: 0.9rem;  color: #6b7280; margin: 0; }
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
  padding: 0;
}
.pdl-btn-add { background: #18a34a; border-color: #18a34a; color: #fff; }
.pdl-btn-add:hover { background: #16923f; }
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
