import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProdutosView from './ProdutosView.vue'
import * as servico from '../services/produtos'
import type { ProdutoGestao } from '../types'
import { falhaComResposta } from '@/testes/falhas'
import { paginaCom, umProdutoDeGestao } from '@/testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('../services/produtos')

function produto(id: string, nome: string, estoque: number): ProdutoGestao {
  return umProdutoDeGestao({ id, sku: `SKU-${id}`, nome, estoque, em_estoque: estoque > 0 })
}

const ROTAS = {
  'admin-produtos': '/admin/produtos',
  'admin-produto-novo': '/admin/produtos/novo',
  'admin-produto': '/admin/produtos/:id',
}

function montarComRouter() {
  return montarNaRota(ProdutosView, '/admin/produtos', ROTAS)
}

async function montar() {
  return (await montarComRouter()).tela
}

beforeEach(() => {
  vi.mocked(servico.listarProdutos)
    .mockReset()
    .mockResolvedValue(paginaCom([produto('a', 'Pod de menta', 0), produto('b', 'Pod de uva', 40)]))
  vi.mocked(servico.ajustarEstoque).mockReset().mockResolvedValue(5)
  vi.mocked(servico.removerProduto).mockReset().mockResolvedValue()
})

describe('ProdutosView', () => {
  it('mostra o estoque de cada produto', async () => {
    const tela = await montar()
    const celulas = tela.findAll('.estoque').map((c) => c.text())

    expect(celulas).toEqual(['0', '40'])
  })

  it('atualiza o estoque na tela depois do ajuste', async () => {
    // `useRequisicao` guarda os dados em shallowRef: escrever no objeto do
    // produto não redesenha nada, e o número ficava parado enquanto o banco
    // já tinha mudado.
    const tela = await montar()

    const repor = tela.findAll('button').filter((b) => b.text().includes('Repor'))
    await repor[0].trigger('click')
    await flushPromises()

    expect(tela.findAll('.estoque').map((c) => c.text())).toEqual(['5', '40'])
  })

  it('ajusta só a linha clicada', async () => {
    const tela = await montar()

    const repor = tela.findAll('button').filter((b) => b.text().includes('Repor'))
    await repor[1].trigger('click')
    await flushPromises()

    expect(servico.ajustarEstoque).toHaveBeenCalledWith('b', 1)
    expect(tela.findAll('.estoque').map((c) => c.text())).toEqual(['0', '5'])
  })

  it('pede confirmação antes de excluir, avisando sobre produto com histórico', async () => {
    const tela = await montar()

    const excluir = tela.findAll('button').find((b) => b.text().includes('Excluir'))!
    await excluir.trigger('click')

    expect(servico.removerProduto).not.toHaveBeenCalled()
    expect(tela.text()).toContain('tire de venda em vez de excluir')
  })

  it('exclui ao confirmar e recarrega a lista', async () => {
    const tela = await montar()
    await tela
      .findAll('button')
      .find((b) => b.text().includes('Excluir'))!
      .trigger('click')

    const confirmar = tela
      .get('dialog')
      .findAll('button')
      .find((b) => b.text().includes('Excluir produto'))!
    await confirmar.trigger('click')
    await flushPromises()

    expect(servico.removerProduto).toHaveBeenCalledWith('a')
    expect(vi.mocked(servico.listarProdutos).mock.calls.length).toBeGreaterThan(1)
  })

  it('mostra a recusa de excluir produto com histórico', async () => {
    // O banco protege quem já foi comprado ou está em algum carrinho.
    vi.mocked(servico.removerProduto).mockRejectedValue(
      falhaComResposta(409, {
        detail: 'Produto em uso por outros registros. Desative em vez de excluir.',
      }),
    )

    const tela = await montar()
    await tela
      .findAll('button')
      .find((b) => b.text().includes('Excluir'))!
      .trigger('click')
    await tela
      .get('dialog')
      .findAll('button')
      .find((b) => b.text().includes('Excluir produto'))!
      .trigger('click')
    await flushPromises()

    expect(tela.text()).toContain('Produto em uso por outros registros')
  })

  it('leva a busca e a página para a rota', async () => {
    const { tela, router } = await montarComRouter()

    await tela.get('input[type="search"]').setValue('menta')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.query.busca).toBe('menta')
  })

  it('traz o catálogo inteiro, inclusive o que está fora de venda', async () => {
    vi.mocked(servico.listarProdutos).mockResolvedValue(
      paginaCom([{ ...produto('c', 'Pod aposentado', 3), ativo: false }]),
    )

    const tela = await montar()

    expect(tela.text()).toContain('Fora de venda')
  })
})
