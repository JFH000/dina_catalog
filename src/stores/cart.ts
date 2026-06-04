import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { CartItem, Product } from '../types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const _catalogId = ref<string | null>(null)

  const totalItems = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  function loadForCatalog(catalogId: string) {
    _catalogId.value = catalogId
    try {
      const raw = localStorage.getItem(`cart:${catalogId}`)
      items.value = raw ? JSON.parse(raw) : []
    } catch {
      items.value = []
    }
  }

  watch(items, (val) => {
    if (!_catalogId.value) return
    if (val.length === 0) {
      localStorage.removeItem(`cart:${_catalogId.value}`)
    } else {
      localStorage.setItem(`cart:${_catalogId.value}`, JSON.stringify(val))
    }
  }, { deep: true })

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
    if (_catalogId.value) localStorage.removeItem(`cart:${_catalogId.value}`)
    items.value = []
  }

  return { items, totalItems, addItem, removeItem, getQuantity, clear, loadForCatalog }
})
