import { afterEach, describe, expect, it, vi } from 'vitest'

/** Os valores são lidos na importação, então cada caso importa de novo. */
async function carregar() {
  vi.resetModules()
  return import('./config')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('configuração de ambiente', () => {
  it('usa o padrão quando a variável vem em branco', async () => {
    vi.stubEnv('VITE_API_URL', '   ')
    vi.stubEnv('VITE_LOCALE', '')

    const config = await carregar()

    expect(config.URL_DA_API).toBe('http://localhost:8000/api')
    expect(config.LOCALE).toBe('pt-BR')
  })

  it('tira a barra do fim da URL da API, que os caminhos já trazem', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.test/api//')

    expect((await carregar()).URL_DA_API).toBe('https://api.exemplo.test/api')
  })

  it('ignora tempo limite que não é número positivo', async () => {
    // Um `NaN` aqui viraria requisição sem limite nenhum.
    for (const valor of ['abc', '0', '-5']) {
      vi.stubEnv('VITE_TIMEOUT_MS', valor)
      expect((await carregar()).TEMPO_LIMITE_MS).toBe(15_000)
    }

    vi.stubEnv('VITE_TIMEOUT_MS', '3000')
    expect((await carregar()).TEMPO_LIMITE_MS).toBe(3000)
  })
})
