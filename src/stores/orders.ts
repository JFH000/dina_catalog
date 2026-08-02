import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Order } from '../types'

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const current = ref<Order | null>(null)

  async function fetchByCatalog(catalogId: string) {
    orders.value = []
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('created_at', { ascending: false })
    if (error) throw error
    orders.value = data
  }

  async function fetchById(id: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    current.value = data
    return data
  }

  async function reject(id: string): Promise<void> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single()
    if (error) throw error
    if (current.value?.id === id) current.value = data
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx !== -1) orders.value[idx] = data
  }

  async function accept(id: string): Promise<Order> {
    const { data, error } = await supabase.functions.invoke('accept-order', {
      body: { orderId: id },
    })
    if (error) {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.().catch(() => null)
      throw new Error(body?.error ?? error.message)
    }
    const updated = data.order as Order
    if (current.value?.id === id) current.value = updated
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx !== -1) orders.value[idx] = updated
    return updated
  }

  return { orders, current, fetchByCatalog, fetchById, reject, accept }
})
