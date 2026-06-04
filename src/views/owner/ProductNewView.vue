<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProductStore } from '../../stores/products'

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()

const catalogId = route.params.id as string

const reference = ref('')
const name = ref('')
const measurements = ref('')
const quality = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const error = ref('')
const loading = ref(false)

let currentBlobUrl = ''

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
  imageFile.value = file
  currentBlobUrl = URL.createObjectURL(file)
  imagePreview.value = currentBlobUrl
}

onUnmounted(() => {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
})

async function save() {
  loading.value = true
  error.value = ''
  try {
    await productStore.addProduct(
      catalogId,
      {
        reference: reference.value.trim(),
        name: name.value.trim(),
        measurements: measurements.value.trim(),
        quality: quality.value.trim(),
      },
      imageFile.value ?? undefined
    )
    router.push(`/catalogs/${catalogId}`)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1>Agregar producto</h1>
    <form @submit.prevent="save" class="form">
      <label>Referencia *</label>
      <input v-model="reference" type="text" placeholder="Ej: REF-001" required />

      <label>Nombre *</label>
      <input v-model="name" type="text" placeholder="Ej: Camisa manga larga" required />

      <label>Medidas *</label>
      <input v-model="measurements" type="text" placeholder="Ej: S, M, L, XL" required />

      <label>Calidad *</label>
      <input v-model="quality" type="text" placeholder="Ej: Premium" required />

      <label>Imagen (opcional)</label>
      <input type="file" accept="image/*" @change="onFileChange" style="margin-bottom:0.75rem" />
      <div v-if="imagePreview" class="preview-wrap">
        <img :src="imagePreview" class="preview" alt="Vista previa" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="button" @click="router.back()">Cancelar</button>
        <button type="submit" class="primary" :disabled="loading">
          {{ loading ? 'Guardando...' : 'Guardar producto' }}
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
.preview-wrap { margin-bottom: 0.75rem; }
.preview { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; }
</style>
