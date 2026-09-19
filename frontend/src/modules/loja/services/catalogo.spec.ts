import { describe, expect, it } from 'vitest'

import { comoQuery } from './catalogo'

describe('comoQuery', () => {
  it('usa os nomes que o DRF espera para busca e ordenação', () => {
    // São os parâmetros do SearchFilter e do OrderingFilter; inventar outro
    // nome faria o backend ignorar o filtro em silêncio.
    expect(comoQuery({ busca: 'menta', ordem: '-preco' })).toEqual({
      search: 'menta',
      ordering: '-preco',
    })
  })

  it('deixa de fora o filtro vazio', () => {
    // `?categoria=` seria recusado com 400 por categoria inválida.
    expect(comoQuery({ categoria: undefined, subtipo: '', busca: '   ' })).toEqual({})
  })

  it('não manda a primeira página, que já é o padrão da API', () => {
    expect(comoQuery({ pagina: 1 })).toEqual({})
    expect(comoQuery({ pagina: 3 })).toEqual({ page: '3' })
  })

  it('tira o espaço em volta do termo buscado', () => {
    expect(comoQuery({ busca: '  nic salt ' })).toEqual({ search: 'nic salt' })
  })

  it('monta a query inteira quando tudo está preenchido', () => {
    expect(
      comoQuery({
        categoria: 'essencia',
        subtipo: 'essencia-nic-salt',
        busca: 'menta',
        ordem: 'preco',
        pagina: 2,
      }),
    ).toEqual({
      categoria: 'essencia',
      subtipo: 'essencia-nic-salt',
      search: 'menta',
      ordering: 'preco',
      page: '2',
    })
  })
})
