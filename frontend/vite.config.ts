import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
// Vem do vitest para que a chave `test` seja tipada; o resto é a config do Vite.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // A porta é a mesma que o backend usa em FRONTEND_URL e CORS_ORIGINS. Se
    // ela mudar aqui, os links de ativação e de senha param de apontar para o
    // lugar certo, então `strictPort` recusa iniciar em outra porta em vez de
    // deixar passar despercebido.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
})
