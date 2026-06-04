import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '../cart'
import type { Product } from '../../types'

const makeProduct = (id: string): Product => ({
  id,
  catalog_id: 'cat1',
  reference: `REF-${id}`,
  name: `Product ${id}`,
  measurements: '10x20',
  quality: 'Alta',
  image_url: null,
  created_at: '',
})

describe('useCartStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const cart = useCartStore()
    expect(cart.items).toHaveLength(0)
    expect(cart.totalItems).toBe(0)
  })

  it('adds a product', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    expect(cart.items).toHaveLength(1)
    expect(cart.getQuantity('a')).toBe(1)
  })

  it('increments quantity on repeat add', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('a'))
    expect(cart.items).toHaveLength(1)
    expect(cart.getQuantity('a')).toBe(2)
  })

  it('decrements quantity on removeItem', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('a'))
    cart.removeItem('a')
    expect(cart.getQuantity('a')).toBe(1)
  })

  it('removes item when quantity reaches 0', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.removeItem('a')
    expect(cart.items).toHaveLength(0)
    expect(cart.getQuantity('a')).toBe(0)
  })

  it('totalItems sums all quantities', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('a'))
    cart.addItem(makeProduct('b'))
    expect(cart.totalItems).toBe(3)
  })

  it('clear empties the cart', () => {
    const cart = useCartStore()
    cart.addItem(makeProduct('a'))
    cart.clear()
    expect(cart.items).toHaveLength(0)
  })
})
