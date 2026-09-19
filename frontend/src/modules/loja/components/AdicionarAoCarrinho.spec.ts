import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSessao } from '@/modules/auth/stores/sessao'
import * as servico from '@/modules/carrinho/services/carrinho'
import AdicionarAoCarrinho from './AdicionarAoCarrinho.vue'
import type { Produto } from '../types'

vi.mock('@/modules/carrinho/services/carrinho')

const PRODUTO: Produto = {
  id: '11111111-1111-1111-1111-111111111111',
  sku: 'POD-0001',
  nome: 'Pod de menta',
  descricao: '',
  marca: 'Marca',
  categoria: 'pod_descartavel',
  subtipo: 'descartavel-caneta',
  preco: '49.90',
  em_estoque: true,
  puffs: 600,
  volume_ml: null,
  nicotina_mg_ml: '50.0',
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/produto/:id', name: 'produto', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio },
      { path: '/carrinho', name: 'carrinho', component: Vazio },
    ],
  })
}

async function montar(produto: Produto = PRODUTO) {
  const router = criarRouter()
  await router.push(`/produto/${produto.id}`)
  await router.isReady()

  const componente = mount(AdicionarAoCarrinho, {
    props: { produto },
    global: { plugins: [router] },
  })
  return { componente, router }
}

function erro400(campos: Record<string, string[]>): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const resposta = {
    status: 400,
    data: campos,
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse
  return new AxiosError('falhou', '400', config, {}, resposta)
}

function carrinhoVazio() {
  return { itens: [], total: '0.00' }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.adicionarItem).mockReset()
  vi.mocked(servico.buscarCarrinho).mockReset()
  vi.mocked(servico.buscarCarrinho).mockResolvedValue(carrinhoVazio())
})

describe('AdicionarAoCarrinho', () => {
  it('manda para o login quem não entrou, guardando o caminho de volta', async () => {
    const { componente, router } = await montar()

    await componente.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('entrar')
    expect(router.currentRoute.value.query.destino).toBe(`/produto/${PRODUTO.id}`)
    // Nem chega a tentar: o endpoint exige conta, e a recusa seria certa.
    expect(servico.adicionarItem).not.toHaveBeenCalled()
  })

  it('adiciona com a quantidade escolhida quando há sessão', async () => {
    useSessao().token = 'token'
    vi.mocked(servico.adicionarItem).mockResolvedValue({
      id: 1,
      produto: { ...PRODUTO, disponivel: true },
      quantidade: 3,
      subtotal: '149.70',
    })
    const { componente } = await montar()

    await componente.get('input[type="number"]').setValue(3)
    await componente.get('button').trigger('click')
    await flushPromises()

    expect(servico.adicionarItem).toHaveBeenCalledWith(PRODUTO.id, 3)
    expect(componente.text()).toContain('Adicionado ao carrinho')
  })

  it('mostra a recusa do backend em vez de decidir por conta própria', async () => {
    useSessao().token = 'token'
    vi.mocked(servico.adicionarItem).mockRejectedValue(
      erro400({ quantidade: ['Quantidade acima do estoque disponível.'] }),
    )
    const { componente } = await montar()

    await componente.get('button').trigger('click')
    await flushPromises()

    expect(componente.text()).toContain('Quantidade acima do estoque disponível.')
    expect(componente.text()).not.toContain('Adicionado ao carrinho')
  })

  it('não oferece o botão para produto sem estoque', async () => {
    const { componente } = await montar({ ...PRODUTO, em_estoque: false })

    expect(componente.find('button').exists()).toBe(false)
    expect(componente.text()).toContain('sem estoque')
  })
})
