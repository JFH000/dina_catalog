import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('../views/auth/LoginView.vue'),
    },
    {
      path: '/dashboard',
      component: () => import('../views/owner/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/catalogs/new',
      component: () => import('../views/owner/CatalogNewView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/catalogs/:id',
      component: () => import('../views/owner/CatalogDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/c/:slug',
      component: () => import('../views/public/CatalogPublicView.vue'),
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return '/login'
  }
})

export default router
