import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import * as servicoCarrinho from '@/modules/carrinho/services/carrinho'
import * as servicoEnderecos from '@/modules/enderecos/services/enderecos'
import type { Endereco } from '@/modules/enderecos/types'
import type { Pedido } from '@/modules/pedidos/types'
import CheckoutView from './CheckoutView.vue'
import * as servicoCheckout from '../services/checkout'

vi.mock('@/modules/carrinho/services/carrinho')
vi.mock('@/modules/enderecos/services/enderecos')
vi.mock('../services/checkout')

const ENDERECO: Endereco = {
  id: 1,
  apelido: 'Casa',
  cep: '01001000',
  logradouro: 'Praça da Sé',
  numero: '100',
  complemento: '',
  bairro: 'Sé',
  cidade: 'São Paulo',
  uf: 'SP',
}

const PEDIDO: Pedido = {
  numero: 'PED-20260919-ABCDEF',
  status: 'aguardando_pagamento',
  status_pagamento: 'pendente',
  itens: [{ sku: 'SKU-1', nome: 'Pod', preco_unitario: '49.90', quantidade: 1, subtotal: '49.90' }],
  entrega: { ...ENDERECO },
  servico_frete: 'economico',
  prazo_frete_em_dias: 4,
  subtotal: '49.90',
  frete: '19.90',
  total: '69.80',
  criado_em: '2026-09-19T00:09:00Z',
  pago_em: null,
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/checkout', name: 'checkout', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
      { path: '/carrinho', name: 'carrinho', component: Vazio },
      { path: '/pedidos/:numero', name: 'pedido', component: Vazio },
    ],
  })
}

async function montar() {
  const router = criarRouter()
  await router.push('/checkout')
  await router.isReady()

  const tela = mount(CheckoutView, { global: { plugins: [router] } })
  await flushPromises()
  return tela
}

function carrinhoCom(quantidade = 1) {
  return {
    itens: [
      {
        id: 1,
        produto: { id: 'p1', sku: 'SKU-1', nome: 'Pod', preco: '49.90', disponivel: true },
        quantidade,
        subtotal: '49.90',
      },
    ],
    total: '49.90',
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servicoCarrinho.buscarCarrinho).mockReset().mockResolvedValue(carrinhoCom())
  vi.mocked(servicoEnderecos.listarEnderecos).mockReset().mockResolvedValue([ENDERECO])
  vi.mocked(servicoCheckout.cotarFrete).mockReset().mockResolvedValue([
    { servico: 'economico', nome: 'Econômico', preco: '19.90', prazo_em_dias: 4 },
  ])
  vi.mocked(servicoCheckout.fecharPedido).mockReset().mockResolvedValue(PEDIDO)
})

/** Clica no botão cujo texto contém o rótulo. */
async function clicar(tela: Awaited<ReturnType<typeof montar>>, texto: string) {
  const botao = tela.findAll('button').find((item) => item.text().includes(texto))
  await botao!.trigger('click')
  await flushPromises()
}

/**
 * Anda do endereço até o resumo.
 *
 * O frete é escolhido pelo rádio, e não por um botão: cada opção é um
 * `<label>` inteiro clicável.
 */
async function avancarAteOResumo(tela: Awaited<ReturnType<typeof montar>>) {
  await clicar(tela, 'Continuar')
  await tela.get('input[type="radio"][value="economico"]').setValue()
  await flushPromises()
  await clicar(tela, 'Continuar')
}

describe('CheckoutView', () => {
  it('fecha o pedido uma vez só, mesmo com dois cliques seguidos', async () => {
    // O botão se desabilita, mas isso é interface. Dois pedidos iguais não se
    // desfazem recarregando a página.
    let liberar!: (pedido: Pedido) => void
    vi.mocked(servicoCheckout.fecharPedido).mockReturnValue(
      new Promise((resolver) => (liberar = resolver)),
    )

    const tela = await montar()
    await avancarAteOResumo(tela)

    const fechar = tela.findAll('button').find((b) => b.text().includes('Fechar pedido'))!
    await fechar.trigger('click')
    await fechar.trigger('click')
    await fechar.trigger('click')

    expect(servicoCheckout.fecharPedido).toHaveBeenCalledTimes(1)

    liberar(PEDIDO)
    await flushPromises()
  })

  it('não fecha de novo depois que o pedido já existe', async () => {
    const tela = await montar()
    await avancarAteOResumo(tela)
    await clicar(tela, 'Fechar pedido')

    expect(tela.text()).toContain('Pedido registrado')
    expect(servicoCheckout.fecharPedido).toHaveBeenCalledTimes(1)
  })

  it('manda só endereço e serviço: os valores são recalculados no servidor', async () => {
    const tela = await montar()
    await avancarAteOResumo(tela)
    await clicar(tela, 'Fechar pedido')

    expect(servicoCheckout.fecharPedido).toHaveBeenCalledWith(ENDERECO.id, 'economico')
  })

  it('recarrega o carrinho depois de fechar, que o backend esvaziou', async () => {
    const tela = await montar()
    const antes = vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length

    await avancarAteOResumo(tela)
    await clicar(tela, 'Fechar pedido')

    expect(vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length).toBeGreaterThan(antes)
  })

  it('barra o fechamento quando o carrinho está vazio', async () => {
    vi.mocked(servicoCarrinho.buscarCarrinho).mockResolvedValue({ itens: [], total: '0.00' })

    const tela = await montar()

    expect(tela.text()).toContain('Não há o que fechar')
  })

  it('mostra a recusa do fechamento e relê o carrinho', async () => {
    const { AxiosError, AxiosHeaders } = await import('axios')
    const config = { headers: new AxiosHeaders() }
    vi.mocked(servicoCheckout.fecharPedido).mockRejectedValue(
      new AxiosError('falhou', '400', config, {}, {
        status: 400,
        data: { pedido: ['Há pedidos demais aguardando pagamento nesta conta.'] },
        statusText: '',
        headers: {},
        config,
      } as never),
    )

    const tela = await montar()
    await avancarAteOResumo(tela)
    const leiturasAntes = vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length

    await clicar(tela, 'Fechar pedido')

    expect(tela.text()).toContain('Há pedidos demais aguardando pagamento')
    // A recusa pode vir de estoque ou de produto retirado de venda.
    expect(vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length).toBeGreaterThan(
      leiturasAntes,
    )
  })

  it('deixa voltar a um passo já cumprido', async () => {
    const tela = await montar()
    await avancarAteOResumo(tela)
    expect(tela.text()).toContain('Confira antes de fechar')

    await clicar(tela, 'Endereço')

    expect(tela.text()).toContain('Para onde entregamos?')
  })

  it('cota o frete de novo ao repetir depois de uma falha', async () => {
    const { ErroDaApi } = await import('@/services/erros')
    vi.mocked(servicoCheckout.cotarFrete).mockRejectedValueOnce(
      new ErroDaApi('rede', 'Sem resposta da loja.', null, {}),
    )

    const tela = await montar()
    await clicar(tela, 'Continuar')
    expect(tela.text()).toContain('Sem resposta da loja')

    await clicar(tela, 'Tentar de novo')

    expect(tela.text()).toContain('Econômico')
  })

  it('barra o fechamento quando há produto indisponível', async () => {
    vi.mocked(servicoCarrinho.buscarCarrinho).mockResolvedValue({
      itens: [
        {
          id: 1,
          produto: { id: 'p1', sku: 'SKU-1', nome: 'Pod', preco: '49.90', disponivel: false },
          quantidade: 1,
          subtotal: '49.90',
        },
      ],
      total: '49.90',
    })

    const tela = await montar()

    expect(tela.text()).toContain('indisponível')
  })
})
