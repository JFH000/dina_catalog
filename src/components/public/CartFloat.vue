<script setup lang="ts">
import { useCartStore } from '../../stores/cart'

const emit = defineEmits<{ openModal: [] }>()
const cart = useCartStore()
</script>

<template>
  <button
    v-if="cart.totalItems > 0"
    class="cart-float"
    @click="emit('openModal')"
  >
    <span class="cart-badge">{{ cart.totalItems }}</span>
    Ver pedido
  </button>
</template>

<style scoped>
.cart-float {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background: #18a34a;
  color: #fff;
  border: none;
  border-radius: 50px;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(24,163,74,0.4);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 100;
  transition: transform 0.15s;
}
.cart-float:hover { transform: scale(1.04); }
.cart-badge {
  background: #fff;
  color: #18a34a;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 700;
}
</style>
