import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from './http'
import { coletarTudo } from './paginacao'

vi.mock('./http', () => ({ http: { get: vi.fn() } }))

const get = vi.mocked(http.get)

function pagina(results: string[], next: string | null) {
  return { data: { count: 0, next, previous: null, results } }
}

beforeEach(() => get.mockReset())

describe('coletarTudo', () => {
  it('junta as páginas seguindo o next que a API devolve', async () => {
    // O backend pagina de 20 em 20 e não aceita tamanho de página do cliente,
    // então uma lista curta que a tela precisa inteira chega cortada.
    get
      .mockResolvedValueOnce(pagina(['a', 'b'], 'http://api/x/?page=2') as never)
      .mockResolvedValueOnce(pagina(['c'], null) as never)

    expect(await coletarTudo<string>('/x/')).toEqual(['a', 'b', 'c'])
    expect(get).toHaveBeenNthCalledWith(1, '/x/')
    expect(get).toHaveBeenNthCalledWith(2, 'http://api/x/?page=2')
  })

  it('para na primeira página quando não há próxima', async () => {
    get.mockResolvedValue(pagina(['a'], null) as never)

    expect(await coletarTudo<string>('/x/')).toEqual(['a'])
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('devolve lista vazia sem estourar', async () => {
    get.mockResolvedValue(pagina([], null) as never)

    expect(await coletarTudo<string>('/x/')).toEqual([])
  })

  it('não entra em laço infinito se o next nunca acabar', async () => {
    // Resposta inesperada não pode travar a aplicação.
    get.mockResolvedValue(pagina(['a'], 'http://api/x/?page=99') as never)

    const itens = await coletarTudo<string>('/x/')

    expect(get.mock.calls.length).toBeLessThanOrEqual(25)
    expect(itens.length).toBeLessThanOrEqual(25)
  })
})
