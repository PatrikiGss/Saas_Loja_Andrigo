/**
 * Lint do frontend. Formatação não mora aqui: é do Prettier, e o
 * `skipFormatting` no fim desliga toda regra de estilo que brigaria com ele.
 *
 * As regras de TypeScript são as que consultam o verificador de tipos. São
 * mais lentas, mas são as únicas que enxergam promessa esquecida sem `await` —
 * uma requisição cuja falha ninguém vê.
 */
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import { globalIgnores } from 'eslint/config'

export default defineConfigWithVueTs(
  {
    name: 'app/arquivos',
    files: ['**/*.{ts,vue}'],
  },

  // `esquema.ts` é gerado de backend/schema.yml por `npm run gerar-tipos`.
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    'test-results/**',
    'playwright-report/**',
    'src/types/esquema.ts',
  ]),

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommendedTypeChecked,

  {
    name: 'app/regras',
    rules: {
      // Com TypeScript, `dica?: string` já diz que o valor pode faltar, e o
      // compilador obriga a tratar isso. Exigir default seria inventar valor
      // para prop que é opcional de verdade.
      'vue/require-default-prop': 'off',
    },
  },

  {
    name: 'app/testes',
    files: ['src/**/*.spec.ts'],
    rules: {
      // Dublê de função assíncrona é `vi.fn(async () => valor)`: a promessa é
      // o contrato, o `await` não tem o que esperar.
      '@typescript-eslint/require-await': 'off',
      // `expect(http.get).toHaveBeenCalled()` separa o método do objeto sem
      // nunca chamá-lo, que é justamente o que esta regra acusa.
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  skipFormatting,
)
