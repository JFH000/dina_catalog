import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'
import type { CsvRow } from '../lib/csv'

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])

  async function fetchByCatalog(catalogId: string) {
    products.value = []
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('catalog_id', catalogId)
      .order('created_at', { ascending: true })
    if (error) throw error
    products.value = data
  }

  async function addProduct(
    catalogId: string,
    fields: { reference: string; name: string; measurements: string; quality: string },
    imageFile?: File
  ): Promise<Product> {
    let image_url: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${catalogId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)
      image_url = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ catalog_id: catalogId, ...fields, image_url })
      .select()
      .single()
    if (error) throw error
    products.value.push(data)
    return data
  }

  async function updateProduct(
    id: string,
    fields: { reference: string; name: string; measurements: string; quality: string },
    imageFile?: File
  ): Promise<void> {
    const updateData: Partial<Product> = { ...fields }

    if (imageFile) {
      const existing = products.value.find(p => p.id === id)
      if (!existing) throw new Error('Product not found in local store')
      const catalogId = existing.catalog_id
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${catalogId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, imageFile)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)
      updateData.image_url = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    const idx = products.value.findIndex(p => p.id === id)
    if (idx !== -1) products.value[idx] = data
  }

  async function toggleProductActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw error
    const product = products.value.find(p => p.id === id)
    if (product) product.is_active = isActive
  }

  async function importProducts(catalogId: string, rows: CsvRow[]): Promise<number> {
    let count = 0
    for (const row of rows) {
      await addProduct(catalogId, {
        reference: row.referencia,
        name: row.nombre,
        measurements: row.medidas,
        quality: row.calidad,
      })
      count++
    }
    return count
  }

  return { products, fetchByCatalog, addProduct, updateProduct, toggleProductActive, importProducts }
})
