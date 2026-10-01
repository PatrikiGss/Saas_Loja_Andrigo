import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatalogoView from './CatalogoView.vue'
import * as servico from '../services/catalogo'
import type { Produto } from '../types'
import { falhaSemResposta } from '../../../testes/falhas'
import { paginaCom, umaEssencia, umSubtipo } from '../../../testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('../services/catalogo')

function produto(id: string, nome: string): Produto {
  return umaEssencia({ id, sku: `SKU-${id}`, nome })
}

const SUBTIPOS = [umSubtipo('essencia-nic-salt', 'essencia', 'Nic salt')]

const ROTAS = {
  catalogo: '/catalogo',
  produto: '/produto/:id',
}

function montar(query = '') {
  return montarNaRota(CatalogoView, `/catalogo${query}`, ROTAS)
}

beforeEach(() => {
  vi.mocked(servico.listarSubtipos).mockReset().mockResolvedValue(SUBTIPOS)
  vi.mocked(servico.listarProdutos)
    .mockReset()
    .mockResolvedValue(paginaCom([produto('a', 'Nic salt menta'), produto('b', 'Nic salt uva')]))
})

describe('CatalogoView', () => {
  it('mostra a grade com a contagem que a API devolveu', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('2 produtos')
    expect(tela.findAll('.grade li')).toHaveLength(2)
  })

  it('lê os filtros da URL e repassa para a API', async () => {
    await montar('?categoria=essencia&subtipo=essencia-nic-salt&busca=menta&ordem=-preco&pagina=2')

    expect(servico.listarProdutos).toHaveBeenCalledWith({
      categoria: 'essencia',
      subtipo: 'essencia-nic-salt',
      busca: 'menta',
      ordem: '-preco',
      pagina: 2,
    })
  })

  it('descarta ordenação que a API não aceita', async () => {
    // Vem da barra de endereço; o backend recusaria o valor.
    await montar('?ordem=inventada')

    expect(servico.listarProdutos).toHaveBeenCalledWith(
      expect.objectContaining({ ordem: undefined }),
    )
  })

  it('escreve o filtro na rota, para o voltar funcionar e o link ser compartilhável', async () => {
    const { tela, router } = await montar()

    const chips = tela.findAll('.chip')
    await chips[1].trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.categoria).toBe('essencia')
  })

  it('volta para a primeira página ao mudar de filtro', async () => {
    const { tela, router } = await montar('?pagina=3')

    await tela.findAll('.chip')[1].trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.query.pagina).toBeUndefined()
  })

  it('busca de novo quando a rota muda', async () => {
    const { router } = await montar()
    const antes = vi.mocked(servico.listarProdutos).mock.calls.length

    await router.push('/catalogo?busca=uva')
    await flushPromises()

    expect(vi.mocked(servico.listarProdutos).mock.calls.length).toBeGreaterThan(antes)
  })

  it('mostra a paginação quando passa de uma página', async () => {
    vi.mocked(servico.listarProdutos).mockResolvedValue(paginaCom([produto('a', 'Um')], 41))

    const { tela } = await montar()

    expect(tela.text()).toContain('Página')
    expect(tela.text()).toContain('3')
  })

  it('sugere afrouxar o filtro quando nada foi encontrado', async () => {
    vi.mocked(servico.listarProdutos).mockResolvedValue(paginaCom([]))

    const { tela } = await montar('?busca=xyz')

    expect(tela.text()).toContain('Nenhum produto com esses filtros')
  })

  it('mostra erro com opção de repetir', async () => {
    vi.mocked(servico.listarProdutos).mockRejectedValue(falhaSemResposta())

    const { tela } = await montar()

    expect(tela.text()).toContain('Sem resposta da loja')
  })

  it('usa o singular quando só há um produto', async () => {
    vi.mocked(servico.listarProdutos).mockResolvedValue(paginaCom([produto('a', 'Um')]))

    const { tela } = await montar()

    expect(tela.text()).toContain('1 produto')
    expect(tela.text()).not.toContain('1 produtos')
  })
})
