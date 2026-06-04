<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '../../types'
import { useCartStore } from '../../stores/cart'

const props = defineProps<{ product: Product }>()
const cart = useCartStore()

const quantity = computed(() => cart.getQuantity(props.product.id))
</script>

<template>
  <tr>
    <td>
      <img v-if="product.image_url" :src="product.image_url" class="thumb" alt="" />
      <span v-else class="no-img">—</span>
    </td>
    <td>{{ product.reference }}</td>
    <td>{{ product.name }}</td>
    <td>{{ product.measurements }}</td>
    <td>{{ product.quality }}</td>
    <td class="qty-cell">
      <div v-if="quantity > 0" class="qty-controls">
        <button class="qty-btn" @click="cart.removeItem(product.id)">−</button>
        <span class="qty-number">{{ quantity }}</span>
        <button class="qty-btn" @click="cart.addItem(product)">+</button>
      </div>
      <button v-else class="add-btn" @click="cart.addItem(product)">+</button>
    </td>
  </tr>
</template>

<style scoped>
.thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 4px; }
.no-img { color: #d1d5db; }
.qty-cell { white-space: nowrap; }
.qty-controls { display: flex; align-items: center; gap: 0.25rem; }
.qty-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  font-size: 1rem;
  line-height: 1;
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
