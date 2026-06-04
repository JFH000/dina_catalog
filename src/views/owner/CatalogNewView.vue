<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const catalogStore = useCatalogStore()
const auth = useAuthStore()

const name = ref('')
const whatsappOverride = ref('')
const error = ref('')
const loading = ref(false)

async function create() {
  if (!name.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    // Always store an effective whatsapp_number so the public view can use it
    // without querying the profiles table (which has owner-only RLS).
    const effectiveWhatsapp =
      whatsappOverride.value.trim() || auth.profile?.whatsapp_number || ''
    const catalog = await catalogStore.createCatalog(name.value.trim(), effectiveWhatsapp)
    router.push(`/catalogs/${catalog.id}`)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1>Nuevo catálogo</h1>
    <form @submit.prevent="create" class="form">
      <label>Nombre del catálogo *</label>
      <input v-model="name" type="text" placeholder="Ej: Colección Verano 2025" required />

      <label>Número WhatsApp para pedidos (opcional)</label>
      <input
        v-model="whatsappOverride"
        type="tel"
        placeholder="Deja vacío para usar el de tu perfil"
      />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="button" @click="router.back()">Cancelar</button>
        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? 'Creando...' : 'Crear catálogo' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.page { max-width: 480px; }
h1 { margin-bottom: 1.5rem; }
.form {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
label { display: block; font-weight: 500; margin-bottom: 0.3rem; font-size: 0.9rem; color: #374151; }
.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
</style>
