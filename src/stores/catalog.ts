import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { generateCatalogSlug } from '../lib/slugify'
import type { Catalog } from '../types'

export const useCatalogStore = defineStore('catalog', () => {
  const catalogs = ref<Catalog[]>([])

  async function fetchMyCatalogs() {
    const { data, error } = await supabase
      .from('catalogs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    catalogs.value = data
  }

  async function createCatalog(name: string, whatsappNumber?: string): Promise<Catalog> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const slug = generateCatalogSlug(name)
    const { data, error } = await supabase
      .from('catalogs')
      .insert({ name, slug, whatsapp_number: whatsappNumber ?? null, is_active: true, owner_id: user.id })
      .select()
      .single()
    if (error) throw error
    catalogs.value.unshift(data)
    return data
  }

  async function toggleActive(id: string, isActive: boolean) {
    const { error } = await supabase
      .from('catalogs')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw error
    const catalog = catalogs.value.find(c => c.id === id)
    if (catalog) catalog.is_active = isActive
  }

  async function fetchBySlug(slug: string): Promise<Catalog | null> {
    const { data } = await supabase
      .from('catalogs')
      .select('*')
      .eq('slug', slug)
      .single()
    return data
  }

  return { catalogs, fetchMyCatalogs, createCatalog, toggleActive, fetchBySlug }
})
