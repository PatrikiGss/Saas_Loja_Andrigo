import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSessao } from '@/modules/auth/stores/sessao'
import PedidoView from './PedidoView.vue'
import PedidosView from './PedidosView.vue'
import * as servico from '../services/pedidos'
import type { Pedido, StatusPedido } from '../types'

vi.mock('../services/pedidos')

function pedido(numero: string, status: StatusPedido = 'aguardando_pagamento'): Pedido {
  return {
    numero,
    status,
    status_pagamento: status === 'aguardando_pagamento' ? 'pendente' : 'pago',
    itens: [
      { sku: 'SKU-1', nome: 'Pod de menta', preco_unitario: '49.90', quantidade: 2, subtotal: '99.80' },
    ],
    entrega: {
      cep: '01001000',
      logradouro: 'Praça da Sé',
      numero: '100',
      complemento: '',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    },
    servico_frete: 'expresso',
    prazo_frete_em_dias: 2,
    subtotal: '99.80',
    frete: '35.82',
    total: '135.62',
    criado_em: '2026-09-19T02:07:30Z',
    pago_em: null,
  }
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pedidos', name: 'pedidos', component: Vazio },
      { path: '/pedidos/:numero', name: 'pedido', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
    ],
  })
}

async function montarLista(caminho = '/pedidos') {
  const router = criarRouter()
  await router.push(caminho)
  await router.isReady()

  const tela = mount(PedidosView, { global: { plugins: [router] } })
  await flushPromises()
  return { tela, router }
}

async function montarDetalhe(numero = 'PED-1') {
  const router = criarRouter()
  await router.push(`/pedidos/${numero}`)
  await router.isReady()

  const tela = mount(PedidoView, { global: { plugins: [router] } })
  await flushPromises()
  return { tela, router }
}

function erro404(): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('falhou', '404', config, {}, {
    status: 404,
    data: { detail: 'No Pedido matches the given query.' },
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.listarPedidos)
    .mockReset()
    .mockResolvedValue({ count: 1, next: null, previous: null, results: [pedido('PED-1')] })
  vi.mocked(servico.buscarPedido).mockReset().mockResolvedValue(pedido('PED-1'))
})

describe('PedidosView', () => {
  it('lista com número, data, itens, status e total', async () => {
    const { tela } = await montarLista()

    expect(tela.text()).toContain('PED-1')
    expect(tela.text()).toContain('2 itens')
    expect(tela.text()).toContain('Aguardando pagamento')
    expect(tela.text()).toContain('135,62')
  })

  it('leva ao detalhe pelo número', async () => {
    const { tela } = await montarLista()

    expect(tela.get('.linha__link').attributes('href')).toBe('/pedidos/PED-1')
  })

  it('convida ao catálogo quando não há pedido', async () => {
    vi.mocked(servico.listarPedidos).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })

    const { tela } = await montarLista()

    expect(tela.text()).toContain('ainda não fez nenhum pedido')
  })

  it('lê a página da URL e busca de novo quando ela muda', async () => {
    const { router } = await montarLista('/pedidos?pagina=2')
    expect(servico.listarPedidos).toHaveBeenCalledWith(2)

    await router.push('/pedidos?pagina=3')
    await flushPromises()

    expect(servico.listarPedidos).toHaveBeenCalledWith(3)
  })

  it('avisa a conta admin de que a lista traz os pedidos de todo mundo', async () => {
    // É a política do backend, não falha da tela.
    const sessao = useSessao()
    sessao.usuario = {
      email: 'admin@example.com',
      nome: '',
      sobrenome: '',
      telefone: '',
      nivel: 'admin',
    }

    const { tela } = await montarLista()

    expect(tela.text()).toContain('pedidos de todas as contas')
  })

  it('não mostra esse aviso para cliente', async () => {
    const { tela } = await montarLista()

    expect(tela.text()).not.toContain('pedidos de todas as contas')
  })

  it('usa o singular com um item só', async () => {
    vi.mocked(servico.listarPedidos).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          ...pedido('PED-2'),
          itens: [
            { sku: 'S', nome: 'Um', preco_unitario: '10.00', quantidade: 1, subtotal: '10.00' },
          ],
        },
      ],
    })

    const { tela } = await montarLista()

    expect(tela.text()).toContain('1 item')
  })
})

describe('PedidoView', () => {
  it('mostra o percurso com a etapa atual marcada', async () => {
    const { tela } = await montarDetalhe()

    expect(tela.findAll('.etapa')).toHaveLength(5)
    expect(tela.get('.etapa--atual').text()).toContain('Aguardando pagamento')
  })

  it('mostra itens congelados, entrega e valores', async () => {
    const { tela } = await montarDetalhe()

    expect(tela.text()).toContain('Pod de menta')
    expect(tela.text()).toContain('01001-000')
    expect(tela.text()).toContain('Expresso')
    expect(tela.text()).toContain('135,62')
  })

  it('avisa que ainda não dá para pagar', async () => {
    const { tela } = await montarDetalhe()

    expect(tela.text()).toContain('pagamento ainda não está disponível')
  })

  it('cala o aviso de pagamento quando o pedido foi pago', async () => {
    vi.mocked(servico.buscarPedido).mockResolvedValue({
      ...pedido('PED-1', 'pago'),
      pago_em: '2026-09-19T03:00:00Z',
    })

    const { tela } = await montarDetalhe()

    expect(tela.text()).not.toContain('pagamento ainda não está disponível')
    expect(tela.text()).toContain('Pago em')
  })

  it('mostra só o cancelamento, sem percurso, num pedido cancelado', async () => {
    vi.mocked(servico.buscarPedido).mockResolvedValue(pedido('PED-1', 'cancelado'))

    const { tela } = await montarDetalhe()

    expect(tela.findAll('.etapa')).toHaveLength(0)
    expect(tela.text()).toContain('não segue para entrega')
  })

  it('trata pedido de outra conta igual a pedido inexistente', async () => {
    // O backend filtra por dono, então os dois casos são o mesmo 404 — e
    // distinguir contaria o que não deve ser contado.
    vi.mocked(servico.buscarPedido).mockRejectedValue(erro404())

    const { tela } = await montarDetalhe('PED-DE-OUTRO')

    expect(tela.text()).toContain('Não encontramos o que você procura.')
    expect(tela.text()).not.toContain('No Pedido matches')
  })

  it('busca de novo quando o número da rota muda', async () => {
    const { router } = await montarDetalhe()
    const antes = vi.mocked(servico.buscarPedido).mock.calls.length

    await router.push('/pedidos/PED-2')
    await flushPromises()

    expect(vi.mocked(servico.buscarPedido).mock.calls.length).toBeGreaterThan(antes)
  })
})
