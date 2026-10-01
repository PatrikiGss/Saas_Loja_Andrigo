import { describe, expect, it } from 'vitest'

import { agruparPorCategoria, corDaCategoria } from './categorias'
import { umSubtipo } from '../../testes/fixtures'

describe('corDaCategoria', () => {
  it('dá um matiz para cada categoria do backend', () => {
    expect(corDaCategoria('pod_descartavel')).toBe('var(--cat-pod-descartavel)')
    expect(corDaCategoria('essencia')).toBe('var(--cat-essencia)')
  })

  it('não quebra com categoria que este arquivo ainda não conhece', () => {
    expect(corDaCategoria('categoria_nova_do_backend')).toBe('var(--cat-indefinida)')
  })
})

describe('agruparPorCategoria', () => {
  it('junta os subtipos e usa o nome legível que veio da API', () => {
    const categorias = agruparPorCategoria([
      umSubtipo('nic-salt', 'essencia', 'Nic salt'),
      umSubtipo('freebase', 'essencia', 'Freebase'),
      umSubtipo('600-puffs', 'pod_descartavel', '600 puffs'),
    ])

    expect(categorias).toHaveLength(2)
    expect(categorias[0].slug).toBe('essencia')
    expect(categorias[0].nome).toBe('Essência')
    expect(categorias[0].subtipos.map((item) => item.slug)).toEqual(['nic-salt', 'freebase'])
    expect(categorias[1].subtipos).toHaveLength(1)
  })

  it('preserva a ordem em que a API mandou', () => {
    const categorias = agruparPorCategoria([
      umSubtipo('600-puffs', 'pod_descartavel', '600 puffs'),
      umSubtipo('nic-salt', 'essencia', 'Nic salt'),
    ])

    expect(categorias.map((categoria) => categoria.slug)).toEqual(['pod_descartavel', 'essencia'])
  })

  it('devolve lista vazia quando não há subtipo', () => {
    expect(agruparPorCategoria([])).toEqual([])
  })
})
