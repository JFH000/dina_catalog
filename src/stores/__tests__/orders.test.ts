import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const fromMock = vi.fn()
const invokeMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}))

import { useOrderStore } from '../orders'

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    catalog_id: 'cat1',
    customer_name: 'Juan',
    customer_email: null,
    customer_phone: null,
    items: [{ product_id: 'p1', quantity: 2 }],
    status: 'pending',
    odoo_invoice_id: null,
    created_at: '2026-08-01T00:00:00Z',
    accepted_at: null,
    rejected_at: null,
    ...overrides,
  }
}

describe('useOrderStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fromMock.mockReset()
    invokeMock.mockReset()
  })

  it('fetchByCatalog loads orders for a catalog', async () => {
    const order = makeOrder()
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [order], error: null }),
        }),
      }),
    })
    const store = useOrderStore()
    await store.fetchByCatalog('cat1')
    expect(store.orders).toEqual([order])
  })

  it('reject sets status to rejected via a conditional update', async () => {
    const rejected = makeOrder({ status: 'rejected', rejected_at: '2026-08-01T01:00:00Z' })
    fromMock.mockReturnValue({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: rejected, error: null }),
            }),
          }),
        }),
      }),
    })
    const store = useOrderStore()
    await store.reject('o1')
    expect(fromMock).toHaveBeenCalledWith('orders')
  })

  it('accept invokes the accept-order edge function and returns the updated order', async () => {
    const accepted = makeOrder({ status: 'accepted', odoo_invoice_id: 42 })
    invokeMock.mockResolvedValue({ data: { order: accepted }, error: null })
    const store = useOrderStore()
    const result = await store.accept('o1')
    expect(invokeMock).toHaveBeenCalledWith('accept-order', { body: { orderId: 'o1' } })
    expect(result.odoo_invoice_id).toBe(42)
  })

  it('accept throws when the edge function returns an error', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('ya fue gestionado') })
    const store = useOrderStore()
    await expect(store.accept('o1')).rejects.toThrow('ya fue gestionado')
  })
})
