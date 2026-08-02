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
    odoo_quotation_id: null,
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
    const updateMock = vi.fn()
    const eqMock = vi.fn()
    const selectMock = vi.fn()
    const singleMock = vi.fn()

    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: vi.fn().mockReturnValue({ select: selectMock }) })
    selectMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: rejected, error: null })

    fromMock.mockReturnValue({ update: updateMock })

    const store = useOrderStore()
    await store.reject('o1')
    expect(fromMock).toHaveBeenCalledWith('orders')
    expect(updateMock).toHaveBeenCalledWith({ status: 'rejected', rejected_at: expect.any(String) })
  })

  it('accept invokes the accept-order edge function and returns the updated order', async () => {
    const accepted = makeOrder({ status: 'accepted', odoo_quotation_id: 42 })
    invokeMock.mockResolvedValue({ data: { order: accepted }, error: null })
    const store = useOrderStore()
    const result = await store.accept('o1')
    expect(invokeMock).toHaveBeenCalledWith('accept-order', { body: { orderId: 'o1' } })
    expect(result.odoo_quotation_id).toBe(42)
  })

  it('accept throws when the edge function returns an error', async () => {
    const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: { json: async () => ({ error: 'ya fue gestionado' }) },
    })
    invokeMock.mockResolvedValue({ data: null, error })
    const store = useOrderStore()
    await expect(store.accept('o1')).rejects.toThrow('ya fue gestionado')
  })

  it('accept preserves the HTTP status on the thrown error so callers can detect an expired session', async () => {
    const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: { status: 401, json: async () => ({ error: 'Not authenticated' }) },
    })
    invokeMock.mockResolvedValue({ data: null, error })
    const store = useOrderStore()
    await expect(store.accept('o1')).rejects.toMatchObject({ status: 401, message: 'Not authenticated' })
  })

  it('reject updates store.current when order matches', async () => {
    const pending = makeOrder()
    const rejected = makeOrder({ status: 'rejected', rejected_at: '2026-08-01T01:00:00Z' })

    const updateMock = vi.fn()
    const eqMock = vi.fn()
    const selectMock = vi.fn()
    const singleMock = vi.fn()

    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: vi.fn().mockReturnValue({ select: selectMock }) })
    selectMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: rejected, error: null })

    fromMock.mockReturnValue({ update: updateMock })

    const store = useOrderStore()
    store.current = pending
    await store.reject('o1')
    expect(store.current).toEqual(rejected)
  })

  it('reject updates store.orders when order exists in array', async () => {
    const pending = makeOrder()
    const rejected = makeOrder({ status: 'rejected', rejected_at: '2026-08-01T01:00:00Z' })
    const otherOrder = makeOrder({ id: 'o2' })

    const updateMock = vi.fn()
    const eqMock = vi.fn()
    const selectMock = vi.fn()
    const singleMock = vi.fn()

    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReturnValue({ eq: vi.fn().mockReturnValue({ select: selectMock }) })
    selectMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: rejected, error: null })

    fromMock.mockReturnValue({ update: updateMock })

    const store = useOrderStore()
    store.orders = [pending, otherOrder]
    await store.reject('o1')
    expect(store.orders[0]).toEqual(rejected)
    expect(store.orders[1]).toEqual(otherOrder)
  })

  it('accept updates store.current when order matches', async () => {
    const pending = makeOrder()
    const accepted = makeOrder({ status: 'accepted', odoo_quotation_id: 42 })

    invokeMock.mockResolvedValue({ data: { order: accepted }, error: null })

    const store = useOrderStore()
    store.current = pending
    await store.accept('o1')
    expect(store.current).toEqual(accepted)
  })

  it('accept updates store.orders when order exists in array', async () => {
    const pending = makeOrder()
    const accepted = makeOrder({ status: 'accepted', odoo_quotation_id: 42 })
    const otherOrder = makeOrder({ id: 'o2' })

    invokeMock.mockResolvedValue({ data: { order: accepted }, error: null })

    const store = useOrderStore()
    store.orders = [pending, otherOrder]
    await store.accept('o1')
    expect(store.orders[0]).toEqual(accepted)
    expect(store.orders[1]).toEqual(otherOrder)
  })
})
