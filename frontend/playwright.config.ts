/**
 * Testes ponta a ponta: o frontend de verdade contra o backend de verdade.
 *
 * O backend sobe com `manage.py testserver`, que cria um banco de teste do
 * zero a cada rodada. A porta 8000 precisa estar livre: rodar contra o
 * servidor de desenvolvimento criaria contas e pedidos no banco de
 * desenvolvimento, então a suíte se recusa a aproveitar um servidor que já
 * esteja de pé ali.
 *
 * Variáveis opcionais:
 * - `E2E_MANAGE`: como chamar o manage.py. O padrão, `python manage.py`,
 *   serve para o CI e para quem está com o venv ativado.
 * - `E2E_NAVEGADOR`: canal de um navegador já instalado, como `msedge` ou
 *   `chrome`, para rodar sem baixar o Chromium do Playwright.
 */
import { defineConfig, devices } from '@playwright/test'

const MANAGE = process.env.E2E_MANAGE ?? 'python manage.py'

export default defineConfig({
  testDir: 'e2e',
  // Um teste por vez: o banco dos testes é SQLite, que serializa a escrita, e
  // concorrência aqui viraria "database is locked" em vez de defeito real.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'preparo', testMatch: /preparo\.setup\.ts/ },
    {
      name: 'navegador',
      use: { ...devices['Desktop Chrome'], channel: process.env.E2E_NAVEGADOR },
      dependencies: ['preparo'],
    },
  ],
  webServer: [
    {
      command: `${MANAGE} testserver configs/fixture_e2e.json --settings=configs.settings_e2e --addrport 8000 --noinput`,
      cwd: '../backend',
      // O runserver escuta só em IPv4, e o Node pode resolver `localhost` para
      // IPv6 primeiro: a checagem de que o servidor subiu esperaria à toa.
      url: 'http://127.0.0.1:8000/api/subtipos/',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
