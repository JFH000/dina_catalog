import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])

  async function fetchByCatalog(catalogId: string) {
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
      const ext = imageFile.name.split('.').pop()
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

  return { products, fetchByCatalog, addProduct }
})
