import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import ProdutosView from './ProdutosView.vue'
import * as servico from '../services/produtos'
import type { ProdutoGestao } from '../types'

vi.mock('../services/produtos')

function produto(id: string, nome: string, estoque: number): ProdutoGestao {
  return {
    id,
    sku: `SKU-${id}`,
    nome,
    descricao: '',
    marca: 'Marca',
    categoria: 'pod_descartavel',
    subtipo: 'descartavel-box',
    preco: '49.90',
    em_estoque: estoque > 0,
    puffs: 600,
    volume_ml: null,
    nicotina_mg_ml: '50.0',
    estoque,
    ativo: true,
    criado_em: '2026-09-19T00:00:00Z',
    atualizado_em: '2026-09-19T00:00:00Z',
  }
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/produtos', name: 'admin-produtos', component: Vazio },
      { path: '/admin/produtos/novo', name: 'admin-produto-novo', component: Vazio },
      { path: '/admin/produtos/:id', name: 'admin-produto', component: Vazio },
    ],
  })
}

async function montarComRouter() {
  const router = criarRouter()
  await router.push('/admin/produtos')
  await router.isReady()

  const tela = mount(ProdutosView, { global: { plugins: [router] } })
  await flushPromises()
  return { tela, router }
}

async function montar() {
  return (await montarComRouter()).tela
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
  }
})

beforeEach(() => {
  vi.mocked(servico.listarProdutos).mockReset().mockResolvedValue({
    count: 2,
    next: null,
    previous: null,
    results: [produto('a', 'Pod de menta', 0), produto('b', 'Pod de uva', 40)],
  })
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
    await tela.findAll('button').find((b) => b.text().includes('Excluir'))!.trigger('click')

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
    const { AxiosError, AxiosHeaders } = await import('axios')
    const config = { headers: new AxiosHeaders() }
    vi.mocked(servico.removerProduto).mockRejectedValue(
      new AxiosError('falhou', '409', config, {}, {
        status: 409,
        data: { detail: 'Produto em uso por outros registros. Desative em vez de excluir.' },
        statusText: '',
        headers: {},
        config,
      } as never),
    )

    const tela = await montar()
    await tela.findAll('button').find((b) => b.text().includes('Excluir'))!.trigger('click')
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
    vi.mocked(servico.listarProdutos).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...produto('c', 'Pod aposentado', 3), ativo: false }],
    })

    const tela = await montar()

    expect(tela.text()).toContain('Fora de venda')
  })
})
