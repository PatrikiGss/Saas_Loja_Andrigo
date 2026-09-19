import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PaginacaoLista from './PaginacaoLista.vue'

function montar(props: { pagina: number; total: number; porPagina?: number }) {
  return mount(PaginacaoLista, {
    props: { porPagina: 20, ...props },
  })
}

describe('PaginacaoLista', () => {
  it('some quando tudo cabe em uma página', () => {
    expect(montar({ pagina: 1, total: 12 }).find('nav').exists()).toBe(false)
    expect(montar({ pagina: 1, total: 20 }).find('nav').exists()).toBe(false)
  })

  it('calcula quantas páginas existem a partir do count da API', () => {
    const paginacao = montar({ pagina: 1, total: 41 })

    expect(paginacao.text()).toContain('de')
    expect(paginacao.text()).toContain('3')
  })

  it('trava o anterior na primeira e o próximo na última', () => {
    const primeira = montar({ pagina: 1, total: 60 })
    const [anterior, proxima] = primeira.findAll('button')
    expect(anterior.attributes('disabled')).toBeDefined()
    expect(proxima.attributes('disabled')).toBeUndefined()

    const ultima = montar({ pagina: 3, total: 60 })
    const [anteriorNaUltima, proximaNaUltima] = ultima.findAll('button')
    expect(anteriorNaUltima.attributes('disabled')).toBeUndefined()
    expect(proximaNaUltima.attributes('disabled')).toBeDefined()
  })

  it('pede a página vizinha ao clicar', async () => {
    const paginacao = montar({ pagina: 2, total: 60 })
    const [anterior, proxima] = paginacao.findAll('button')

    await proxima.trigger('click')
    await anterior.trigger('click')

    expect(paginacao.emitted('irPara')).toEqual([[3], [1]])
  })

  it('não deixa navegar enquanto a lista está carregando', async () => {
    const paginacao = mount(PaginacaoLista, {
      props: { pagina: 2, total: 60, porPagina: 20, desabilitado: true },
    })

    for (const botao of paginacao.findAll('button')) {
      expect(botao.attributes('disabled')).toBeDefined()
    }
  })
})
