import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import CarrinhoView from './CarrinhoView.vue'
import * as servico from '../services/carrinho'
import { useCarrinho } from '../stores/carrinho'
import type { ItemCarrinho } from '../types'

vi.mock('../services/carrinho')

function item(id: number, nome: string, disponivel = true): ItemCarrinho {
  return {
    id,
    produto: { id: `p${id}`, sku: `SKU-${id}`, nome, preco: '49.90', disponivel },
    quantidade: 2,
    subtotal: '99.80',
  }
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/carrinho', name: 'carrinho', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
      { path: '/checkout', name: 'checkout', component: Vazio },
    ],
  })
}

async function montar() {
  const router = criarRouter()
  await router.push('/carrinho')
  await router.isReady()

  const tela = mount(CarrinhoView, { global: { plugins: [router] } })
  // A store carrega no `onMounted` da view.
  await useCarrinho().carregar()
  await flushPromises()
  return { tela, router }
}

async function clicar(tela: Awaited<ReturnType<typeof montar>>['tela'], texto: string) {
  await tela.findAll('button').find((b) => b.text().includes(texto))!.trigger('click')
  await flushPromises()
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
  setActivePinia(createPinia())
  vi.mocked(servico.buscarCarrinho)
    .mockReset()
    .mockResolvedValue({ itens: [item(1, 'Pod de menta')], total: '99.80' })
  vi.mocked(servico.alterarQuantidade).mockReset().mockResolvedValue(item(1, 'Pod de menta'))
  vi.mocked(servico.removerItem).mockReset().mockResolvedValue()
  vi.mocked(servico.esvaziar).mockReset().mockResolvedValue()
})

describe('CarrinhoView', () => {
  it('lista os itens com o total do servidor', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Pod de menta')
    expect(tela.text()).toContain('99,80')
  })

  it('convida ao catálogo quando está vazio', async () => {
    vi.mocked(servico.buscarCarrinho).mockResolvedValue({ itens: [], total: '0.00' })

    const { tela } = await montar()

    expect(tela.text()).toContain('Seu carrinho está vazio')
    expect(tela.findAll('a').map((a) => a.attributes('href'))).toContain('/catalogo')
  })

  it('leva ao fechamento do pedido', async () => {
    const { tela, router } = await montar()

    await clicar(tela, 'Fechar pedido')

    expect(router.currentRoute.value.path).toBe('/checkout')
  })

  it('barra o fechamento quando há item indisponível', async () => {
    // O backend recusaria o checkout; avisar aqui evita a viagem perdida.
    vi.mocked(servico.buscarCarrinho).mockResolvedValue({
      itens: [item(1, 'Pod aposentado', false)],
      total: '99.80',
    })

    const { tela } = await montar()
    const fechar = tela.findAll('button').find((b) => b.text().includes('Fechar pedido'))!

    expect(fechar.attributes('disabled')).toBeDefined()
    expect(tela.text()).toContain('Retire o item indisponível')
  })

  it('pede confirmação antes de limpar, e só então chama a API', async () => {
    const { tela } = await montar()

    await clicar(tela, 'Limpar carrinho')
    expect(servico.esvaziar).not.toHaveBeenCalled()
    expect(tela.text()).toContain('Não dá para desfazer')

    // O botão de confirmar é o de dentro do diálogo: o da página tem o mesmo
    // texto e só reabriria a caixa.
    const confirmar = tela
      .get('dialog')
      .findAll('button')
      .find((b) => b.text().includes('Limpar carrinho'))!
    await confirmar.trigger('click')
    await flushPromises()

    expect(servico.esvaziar).toHaveBeenCalledTimes(1)
  })

  it('remove um item pelo id', async () => {
    const { tela } = await montar()

    await clicar(tela, 'Remover')

    expect(servico.removerItem).toHaveBeenCalledWith(1)
  })

  it('mantém a lista na tela quando uma alteração é recusada', async () => {
    vi.mocked(servico.removerItem).mockRejectedValue(
      new AxiosError('falhou', '400', { headers: new AxiosHeaders() }, {}, {
        status: 400,
        data: { detail: 'Não deu.' },
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
      } as AxiosResponse),
    )

    const { tela } = await montar()
    await clicar(tela, 'Remover')

    expect(tela.text()).toContain('Não deu.')
    // O carrinho continua visível: a pessoa vê o que foi recusado.
    expect(tela.text()).toContain('Pod de menta')
  })

  it('diz que o frete vem depois, porque depende do destino', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('frete depende do destino')
  })
})
