import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import type { Catalog, Product } from '../../../types'

const insertMock = vi.fn()

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (...args: unknown[]) => insertMock(...args) }),
  },
}))

import OrderModal from '../OrderModal.vue'
import { useCartStore } from '../../../stores/cart'

const catalog: Catalog = {
  id: 'cat1',
  owner_id: 'u1',
  name: 'Verano',
  slug: 'verano',
  whatsapp_number: '+57 300 123 4567',
  is_active: true,
  created_at: '',
}

const product: Product = {
  id: 'p1',
  catalog_id: 'cat1',
  reference: 'REF01',
  name: 'Camisa',
  measurements: '',
  quality: '',
  image_url: null,
  is_active: true,
  created_at: '',
}

describe('OrderModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    insertMock.mockReset()
    vi.stubGlobal('open', vi.fn())
  })

  it('opens the WhatsApp link synchronously, before awaiting the order insert, so iOS Safari does not drop the user gesture', async () => {
    // Insert never resolves during this test, simulating a slow network call.
    insertMock.mockReturnValue(new Promise(() => {}))

    const cart = useCartStore()
    cart.items = [{ product, quantity: 2 }]

    const wrapper = mount(OrderModal, {
      props: { catalog, whatsappNumber: catalog.whatsapp_number! },
    })

    await wrapper.find('.whatsapp-btn').trigger('click')

    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/573001234567'), '_blank')
  })
})
