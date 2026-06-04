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
