<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalogStore } from '../../stores/catalog'

const router = useRouter()
const catalogStore = useCatalogStore()

const publicBase = computed(() => window.location.origin)
const loading = ref(true)
const fetchError = ref('')
const copiedId = ref<string | null>(null)

onMounted(async () => {
  try {
    await catalogStore.fetchMyCatalogs()
  } catch {
    fetchError.value = 'No se pudieron cargar los catálogos. Intenta recargar la página.'
  } finally {
    loading.value = false
  }
})

async function toggleActive(id: string, current: boolean) {
  try {
    await catalogStore.toggleActive(id, !current)
  } catch {
    // store state unchanged on failure — no visual glitch
  }
}

function copyLink(slug: string, id: string) {
  navigator.clipboard.writeText(`${publicBase.value}/c/${slug}`)
  copiedId.value = id
  setTimeout(() => { copiedId.value = null }, 2000)
}
</script>

<template>
  <div>
    <div class="header">
      <h1>Mis catálogos</h1>
      <router-link to="/catalogs/new">
        <button class="primary">+ Nuevo catálogo</button>
      </router-link>
    </div>

    <p v-if="loading" class="state">Cargando...</p>
    <p v-else-if="fetchError" class="error">{{ fetchError }}</p>
    <p v-else-if="catalogStore.catalogs.length === 0" class="empty">
      Aún no tienes catálogos. ¡Crea el primero!
    </p>

    <div v-else class="catalog-list">
      <div
        v-for="catalog in catalogStore.catalogs"
        :key="catalog.id"
        class="catalog-card"
        @click="router.push(`/catalogs/${catalog.id}`)"
      >
        <div class="card-top">
          <div class="card-name">
            <strong>{{ catalog.name }}</strong>
            <span class="badge" :class="catalog.is_active ? 'active' : 'inactive'">
              {{ catalog.is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </div>
          <div class="card-actions" @click.stop>
            <button @click="copyLink(catalog.slug, catalog.id)" :class="{ copied: copiedId === catalog.id }">
              {{ copiedId === catalog.id ? '✓ Copiado' : 'Copiar link' }}
            </button>
            <button @click="toggleActive(catalog.id, catalog.is_active)">
              {{ catalog.is_active ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
        </div>
        <p class="slug">/c/{{ catalog.slug }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.catalog-list { display: flex; flex-direction: column; gap: 0.75rem; }
.catalog-card {
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.catalog-card:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.1); }
.card-top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.card-name { display: flex; align-items: center; gap: 0.5rem; }
.card-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.badge {
  padding: 0.15rem 0.5rem;
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
}
.active { background: #dcfce7; color: #166534; }
.inactive { background: #f3f4f6; color: #6b7280; }
.slug { color: #9ca3af; font-size: 0.8rem; margin-top: 0.4rem; }
.state { color: #9ca3af; margin-top: 1rem; }
.empty { color: #9ca3af; margin-top: 3rem; text-align: center; }
button.copied { background: #dcfce7; color: #166534; border-color: #86efac; }
</style>
