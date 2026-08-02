<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const fullName = ref('')
const whatsappNumber = ref('')
const error = ref(route.query.expired ? 'Tu sesión expiró. Inicia sesión de nuevo.' : '')
const loading = ref(false)

function toggleMode() {
  isSignUp.value = !isSignUp.value
  error.value = ''
  email.value = ''
  password.value = ''
  fullName.value = ''
  whatsappNumber.value = ''
}

async function submit() {
  loading.value = true
  error.value = ''
  try {
    if (isSignUp.value) {
      await auth.signUp(email.value, password.value, fullName.value, whatsappNumber.value)
    } else {
      await auth.signIn(email.value, password.value)
    }
    router.push((route.query.redirect as string) || '/dashboard')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-box">
      <h1>{{ isSignUp ? 'Crear cuenta' : 'Iniciar sesión' }}</h1>
      <form @submit.prevent="submit">
        <input v-model="email" type="email" placeholder="Correo electrónico" required />
        <input v-model="password" type="password" placeholder="Contraseña" required />
        <template v-if="isSignUp">
          <input v-model="fullName" type="text" placeholder="Nombre completo" required />
          <input
            v-model="whatsappNumber"
            type="tel"
            placeholder="Número WhatsApp (ej: +573001234567)"
            required
          />
        </template>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="primary" :disabled="loading" style="width:100%">
          {{ loading ? 'Cargando...' : (isSignUp ? 'Crear cuenta' : 'Entrar') }}
        </button>
      </form>
      <p class="toggle-link">
        <a href="#" @click.prevent="toggleMode">
          {{ isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate' }}
        </a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
}
.login-box {
  background: #fff;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 400px;
}
h1 { margin-bottom: 1.5rem; font-size: 1.4rem; }
.toggle-link { margin-top: 1rem; text-align: center; }
.toggle-link a { color: #18a34a; text-decoration: none; font-size: 0.9rem; }
</style>
