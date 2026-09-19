import { describe, expect, it } from 'vitest'

import { listaDe, objetoCom, paginaDe } from './conferencia'
import { ErroDaApi } from './erros'

interface Item {
  id: number
  nome: string
}

const CHAVES = ['id', 'nome'] as const

describe('objetoCom', () => {
  it('deixa passar a resposta com as chaves esperadas', () => {
    expect(objetoCom<Item>({ id: 1, nome: 'A', extra: true }, CHAVES)).toEqual({
      id: 1,
      nome: 'A',
      extra: true,
    })
  })

  it('recusa quando falta chave que o código vai usar', () => {
    // Sem isto, `undefined` seguiria para a tela e quebraria no desenho, com
    // um erro que não diz nada sobre a causa.
    expect(() => objetoCom<Item>({ id: 1 }, CHAVES)).toThrow(ErroDaApi)
  })

  it('recusa o que não é objeto', () => {
    for (const valor of [null, undefined, 'texto', 42, [1, 2]]) {
      expect(() => objetoCom<Item>(valor, CHAVES)).toThrow(ErroDaApi)
    }
  })

  it('aceita chave presente com valor nulo', () => {
    // Nulo é resposta legítima: `pago_em` vem assim até o pedido ser pago.
    expect(() => objetoCom<Item>({ id: 1, nome: null }, CHAVES)).not.toThrow()
  })

  it('explica o que fazer, sem falar do sistema por dentro', () => {
    try {
      objetoCom<Item>({}, CHAVES)
    } catch (falha) {
      const erro = falha as ErroDaApi
      expect(erro.message).toContain('Recarregue a página')
      expect(erro.message).not.toContain('undefined')
    }
  })
})

describe('listaDe', () => {
  it('confere cada item da lista', () => {
    expect(listaDe<Item>([{ id: 1, nome: 'A' }], CHAVES)).toHaveLength(1)
    expect(() => listaDe<Item>([{ id: 1, nome: 'A' }, { id: 2 }], CHAVES)).toThrow(ErroDaApi)
  })

  it('aceita lista vazia', () => {
    expect(listaDe<Item>([], CHAVES)).toEqual([])
  })

  it('recusa o que não é lista', () => {
    expect(() => listaDe<Item>({ id: 1, nome: 'A' }, CHAVES)).toThrow(ErroDaApi)
  })
})

describe('paginaDe', () => {
  const pagina = { count: 1, next: null, previous: null, results: [{ id: 1, nome: 'A' }] }

  it('deixa passar a página do DRF', () => {
    expect(paginaDe<Item>(pagina, CHAVES).results).toHaveLength(1)
  })

  it('recusa página sem as chaves da paginação', () => {
    expect(() => paginaDe<Item>({ results: [] }, CHAVES)).toThrow(ErroDaApi)
  })

  it('exige count numérico, senão a conta de páginas vira NaN', () => {
    expect(() => paginaDe<Item>({ ...pagina, count: 'muitos' }, CHAVES)).toThrow(ErroDaApi)
  })

  it('exige results em lista', () => {
    expect(() => paginaDe<Item>({ ...pagina, results: 'nenhum' }, CHAVES)).toThrow(ErroDaApi)
  })

  it('confere também os itens de dentro', () => {
    expect(() => paginaDe<Item>({ ...pagina, results: [{ id: 1 }] }, CHAVES)).toThrow(ErroDaApi)
  })

  it('sem chaves declaradas, confere só o envelope', () => {
    expect(() => paginaDe<Item>({ ...pagina, results: [{ qualquer: 1 }] }, [])).not.toThrow()
  })
})
