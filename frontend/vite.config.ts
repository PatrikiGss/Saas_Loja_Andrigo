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
    // O jsdom não tem `<dialog>` modal; o preparo dá o mínimo que os testes usam.
    setupFiles: ['src/testes/configuracao.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,vue}'],
      // Fora da conta só o que não é comportamento da aplicação: declaração
      // de tipo, gerada ou não, a partida, e o apoio dos próprios testes.
      exclude: [
        'src/**/*.spec.ts',
        'src/**/types.ts',
        'src/types/esquema.ts',
        'src/testes/**',
        'src/main.ts',
        'src/env.d.ts',
      ],
      // Os limites ficam um pouco abaixo do que a suíte alcança, para impedir
      // regressão sem quebrar o CI a cada linha nova. Subir isto significa
      // escrever teste, não afrouxar o `exclude`.
      thresholds: { lines: 96, functions: 93, branches: 93, statements: 96 },
    },
  },
})
