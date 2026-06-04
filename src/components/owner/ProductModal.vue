<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Product } from '../../types'
import { useProductStore } from '../../stores/products'

const props = defineProps<{
  product?: Product
  catalogId: string
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const productStore = useProductStore()

const reference = ref('')
const name = ref('')
const measurements = ref('')
const quality = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref('')
const loading = ref(false)
const error = ref('')

const isEdit = computed(() => !!props.product)

watch(
  () => props.product,
  (p) => {
    reference.value = p?.reference ?? ''
    name.value = p?.name ?? ''
    measurements.value = p?.measurements ?? ''
    quality.value = p?.quality ?? ''
    imageFile.value = null
    imagePreview.value = p?.image_url ?? ''
    error.value = ''
  },
  { immediate: true }
)

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
    const fields = {
      reference: reference.value.trim(),
      name: name.value.trim(),
      measurements: measurements.value.trim(),
      quality: quality.value.trim(),
    }
    if (props.product) {
      await productStore.updateProduct(props.product.id, fields, imageFile.value ?? undefined)
    } else {
      await productStore.addProduct(props.catalogId, fields, imageFile.value ?? undefined)
    }
    emit('saved')
    emit('close')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="!loading && emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ isEdit ? 'Editar producto' : 'Nuevo producto' }}</h2>
        <button class="close-btn" :disabled="loading" @click="!loading && emit('close')">✕</button>
      </div>

      <form @submit.prevent="save">
        <label>Referencia *</label>
        <input v-model="reference" type="text" placeholder="Ej: REF-001" required />

        <label>Nombre *</label>
        <input v-model="name" type="text" placeholder="Ej: Camisa manga larga" required />

        <label>Medidas *</label>
        <input v-model="measurements" type="text" placeholder="Ej: S, M, L, XL" required />

        <label>Calidad *</label>
        <input v-model="quality" type="text" placeholder="Ej: Premium" required />

        <label>Imagen (opcional)</label>
        <input type="file" accept="image/*" @change="onFileChange" class="file-input" />
        <div v-if="imagePreview" class="preview-wrap">
          <img :src="imagePreview" class="preview" alt="Vista previa" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <div class="actions">
          <button type="button" :disabled="loading" @click="!loading && emit('close')">
            Cancelar
          </button>
          <button type="submit" class="primary" :disabled="loading">
            {{ loading ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear producto') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}
.modal {
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.modal-header h2 { font-size: 1.15rem; }
.close-btn { background: none; border: none; font-size: 1.1rem; color: #9ca3af; padding: 0; cursor: pointer; }
label { display: block; font-weight: 500; margin-bottom: 0.3rem; font-size: 0.9rem; color: #374151; }
.file-input { margin-bottom: 0.75rem; }
.preview-wrap { margin-bottom: 0.75rem; }
.preview { width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
.actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
</style>
