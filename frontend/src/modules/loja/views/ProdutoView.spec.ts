import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import ProdutoView from './ProdutoView.vue'
import * as servico from '../services/catalogo'
import type { Produto, Subtipo } from '../types'

vi.mock('../services/catalogo')
vi.mock('@/modules/carrinho/services/carrinho')

const PRODUTO: Produto = {
  id: 'uuid-1',
  sku: 'ESS-0001',
  nome: 'Nic salt menta',
  descricao: 'Essência de menta.',
  marca: 'Elfbar',
  categoria: 'essencia',
  subtipo: 'essencia-nic-salt',
  preco: '49.90',
  em_estoque: true,
  puffs: null,
  volume_ml: '30.00',
  nicotina_mg_ml: '35.0',
}

const SUBTIPOS: Subtipo[] = [
  {
    slug: 'essencia-nic-salt',
    nome: 'Nic salt',
    categoria: 'essencia',
    categoria_display: 'Essência',
  },
]

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/produto/:id', name: 'produto', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio },
      { path: '/carrinho', name: 'carrinho', component: Vazio },
    ],
  })
}

async function montar(id = 'uuid-1') {
  const router = criarRouter()
  await router.push(`/produto/${id}`)
  await router.isReady()

  const tela = mount(ProdutoView, { global: { plugins: [router] } })
  await flushPromises()
  return { tela, router }
}

function erro404(): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('falhou', '404', config, {}, {
    status: 404,
    data: { detail: 'No Produto matches the given query.' },
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.buscarProduto).mockReset().mockResolvedValue(PRODUTO)
  vi.mocked(servico.listarSubtipos).mockReset().mockResolvedValue(SUBTIPOS)
})

describe('ProdutoView', () => {
  it('mostra nome, marca, preço e descrição', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Nic salt menta')
    expect(tela.text()).toContain('Elfbar')
    expect(tela.text()).toContain('49,90')
    expect(tela.text()).toContain('Essência de menta.')
  })

  it('traduz categoria e subtipo com o que veio da API', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Essência')
    expect(tela.text()).toContain('Nic salt')
    // Nunca o identificador cru.
    expect(tela.text()).not.toContain('essencia-nic-salt')
  })

  it('lista só as especificações que se aplicam à categoria', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Volume')
    expect(tela.text()).toContain('Nicotina')
    expect(tela.text()).not.toContain('Puffs')
  })

  it('mostra o SKU do produto', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('ESS-0001')
  })

  it('não mostra o texto interno do Django quando o produto não existe', async () => {
    vi.mocked(servico.buscarProduto).mockRejectedValue(erro404())

    const { tela } = await montar('nao-existe')

    expect(tela.text()).toContain('Não encontramos o que você procura.')
    expect(tela.text()).not.toContain('No Produto matches')
    expect(tela.text()).toContain('Voltar para o catálogo')
  })

  it('busca de novo quando o id da rota muda', async () => {
    const { router } = await montar()
    const antes = vi.mocked(servico.buscarProduto).mock.calls.length

    await router.push('/produto/uuid-2')
    await flushPromises()

    expect(vi.mocked(servico.buscarProduto).mock.calls.length).toBeGreaterThan(antes)
  })

  it('avisa enquanto carrega', async () => {
    vi.mocked(servico.buscarProduto).mockReturnValue(new Promise(() => {}))
    const router = criarRouter()
    await router.push('/produto/uuid-1')

    const tela = mount(ProdutoView, { global: { plugins: [router] } })
    await tela.vm.$nextTick()

    expect(tela.text()).toContain('Carregando')
  })

  it('diz que está sem estoque em vez de oferecer o botão', async () => {
    vi.mocked(servico.buscarProduto).mockResolvedValue({ ...PRODUTO, em_estoque: false })

    const { tela } = await montar()

    expect(tela.text()).toContain('sem estoque')
    expect(tela.find('button').exists()).toBe(false)
  })
})
