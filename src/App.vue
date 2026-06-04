<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function logout() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="app">
    <nav v-if="auth.user" class="nav">
      <router-link to="/dashboard">Mis catálogos</router-link>
      <button @click="logout">Cerrar sesión</button>
    </nav>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
.app { min-height: 100vh; }
.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.875rem 2rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.nav a { text-decoration: none; color: #333; font-weight: 500; font-size: 0.95rem; }
.nav a:hover { color: #18a34a; }
main { padding: 2rem; max-width: 960px; margin: 0 auto; }
@media (max-width: 600px) {
  .nav { padding: 0.75rem 1rem; gap: 1rem; }
  main { padding: 1rem; }
}
button {
  cursor: pointer;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 0.9rem;
  transition: background 0.1s;
}
button:hover:not(:disabled) { background: #f9fafb; }
button.primary { background: #18a34a; color: #fff; border-color: #18a34a; }
button.primary:hover:not(:disabled) { background: #16923f; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 0.75rem;
  outline: none;
  transition: border-color 0.15s;
}
input:focus { border-color: #18a34a; }
.error { color: #dc2626; margin: 0.5rem 0 0.75rem; font-size: 0.9rem; }
</style>
