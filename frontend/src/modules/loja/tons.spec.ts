import { describe, expect, it } from 'vitest'

import { tomDoProduto } from './tons'

describe('tomDoProduto', () => {
  it('dá sempre o mesmo tom ao mesmo SKU', () => {
    // O tom não é guardado em lugar nenhum: ele precisa sair do SKU igual em
    // toda sessão, senão o produto mudaria de cor a cada visita.
    expect(tomDoProduto('POD-0001')).toEqual(tomDoProduto('POD-0001'))
  })

  it('mistura só com papel ou tinta, que são cores da paleta', () => {
    const skus = ['POD-0001', 'ESS-NIC-10', 'VAPE-KIT-1', 'X-9', 'AAAA', 'ZZZZ-1']

    for (const sku of skus) {
      const tom = tomDoProduto(sku)
      expect(['var(--papel)', 'var(--tinta)']).toContain(tom.base)
      expect(tom.quantidade).toMatch(/^\d+%$/)
    }
  })

  it('não mistura tanto a ponto de apagar o matiz da categoria', () => {
    const skus = Array.from({ length: 60 }, (_, i) => `POD-${String(i).padStart(4, '0')}`)

    for (const sku of skus) {
      expect(Number(tomDoProduto(sku).quantidade.replace('%', ''))).toBeLessThanOrEqual(30)
    }
  })

  it('espalha os tons em vez de cair sempre no mesmo', () => {
    const skus = Array.from({ length: 40 }, (_, i) => `POD-${String(i).padStart(4, '0')}`)
    const distintos = new Set(skus.map((sku) => JSON.stringify(tomDoProduto(sku))))

    expect(distintos.size).toBeGreaterThan(2)
  })

  it('não quebra com SKU vazio', () => {
    expect(tomDoProduto('').base).toBeTruthy()
  })
})
