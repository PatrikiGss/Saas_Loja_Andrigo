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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,vue}'],
      // Fora da conta só o que não tem comportamento: declaração de tipo e a
      // partida da aplicação.
      exclude: ['src/**/*.spec.ts', 'src/**/types.ts', 'src/main.ts', 'src/env.d.ts'],
      // Os limites são o que a suíte alcança hoje, e servem para impedir
      // regressão — não são meta. A lacuna conhecida são as views: serviços,
      // stores, composables e componentes reutilizáveis estão cobertos; as
      // telas que só montam esses pedaços, em boa parte, não. Subir isto
      // significa escrever teste de view, não afrouxar o `exclude`.
      thresholds: { lines: 60, functions: 48, branches: 50, statements: 60 },
    },
  },
})
