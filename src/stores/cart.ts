import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, Product } from '../types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const totalItems = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  function addItem(product: Product) {
    const existing = items.value.find(i => i.product.id === product.id)
    if (existing) {
      existing.quantity++
    } else {
      items.value.push({ product, quantity: 1 })
    }
  }

  function removeItem(productId: string) {
    const existing = items.value.find(i => i.product.id === productId)
    if (!existing) return
    if (existing.quantity > 1) {
      existing.quantity--
    } else {
      items.value = items.value.filter(i => i.product.id !== productId)
    }
  }

  function getQuantity(productId: string): number {
    return items.value.find(i => i.product.id === productId)?.quantity ?? 0
  }

  function clear() {
    items.value = []
  }

  return { items, totalItems, addItem, removeItem, getQuantity, clear }
})
