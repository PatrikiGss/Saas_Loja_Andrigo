import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import App from '@/App.vue'
import LayoutAdmin from '@/modules/admin/layouts/LayoutAdmin.vue'
import { useSessao } from '@/modules/auth/stores/sessao'
import * as servicoAuth from '@/modules/auth/services/auth'
import { useCarrinho } from '@/modules/carrinho/stores/carrinho'
import type { Nivel } from '@/modules/auth/types'
import LayoutLoja from './LayoutLoja.vue'

vi.mock('@/modules/auth/services/auth')

const Vazio = defineComponent({ setup: () => () => h('div', 'conteúdo') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'inicio', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
      { path: '/carrinho', name: 'carrinho', component: Vazio },
      { path: '/pedidos', name: 'pedidos', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio },
      { path: '/conta', name: 'conta', component: Vazio },
      { path: '/admin/produtos', name: 'admin-produtos', component: Vazio, meta: { admin: true } },
      { path: '/admin/pedidos', name: 'admin-pedidos', component: Vazio, meta: { admin: true } },
      { path: '/admin/usuarios', name: 'admin-usuarios', component: Vazio, meta: { admin: true } },
    ],
  })
}

function entrarComo(nivel: Nivel): void {
  const sessao = useSessao()
  sessao.token = 'token'
  sessao.usuario = {
    email: 'conta@example.com',
    nome: 'Ana',
    sobrenome: 'Lima',
    telefone: '',
    nivel,
  }
}

async function montar(moldura: Component, caminho = '/') {
  const router = criarRouter()
  await router.push(caminho)
  await router.isReady()

  const tela = mount(moldura, {
    global: { plugins: [router] },
    slots: { default: '<p>miolo</p>' },
  })
  await flushPromises()
  return { tela, router }
}

function enderecos(tela: ReturnType<typeof mount>): (string | undefined)[] {
  return tela.findAll('a').map((a) => a.attributes('href'))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servicoAuth.encerrarSessao).mockReset().mockResolvedValue()
})

describe('LayoutLoja', () => {
  it('oferece só o catálogo e a entrada a quem não entrou', async () => {
    const { tela } = await montar(LayoutLoja)

    expect(enderecos(tela)).toContain('/catalogo')
    expect(enderecos(tela)).toContain('/entrar')
    expect(enderecos(tela)).not.toContain('/pedidos')
    expect(enderecos(tela)).not.toContain('/carrinho')
  })

  it('mostra pedidos, carrinho e o nome de quem entrou', async () => {
    entrarComo('usuario')

    const { tela } = await montar(LayoutLoja)

    expect(enderecos(tela)).toContain('/pedidos')
    expect(enderecos(tela)).toContain('/carrinho')
    expect(enderecos(tela)).toContain('/conta')
    expect(tela.text()).toContain('Ana Lima')
  })

  it('conta os itens do carrinho ao lado do link', async () => {
    entrarComo('usuario')
    const carrinho = useCarrinho()
    carrinho.itens = [
      {
        id: 1,
        produto: { id: 'p', sku: 'S', nome: 'N', preco: '1.00', disponivel: true },
        quantidade: 3,
        subtotal: '3.00',
      },
    ]

    const { tela } = await montar(LayoutLoja)

    expect(tela.get('.conta__contagem').text()).toContain('3')
  })

  it('não desenha a contagem com o carrinho vazio', async () => {
    entrarComo('usuario')

    const { tela } = await montar(LayoutLoja)

    expect(tela.find('.conta__contagem').exists()).toBe(false)
  })

  it('oferece a gestão só para conta admin', async () => {
    entrarComo('usuario')
    const { tela: cliente } = await montar(LayoutLoja)
    expect(enderecos(cliente)).not.toContain('/admin/produtos')

    setActivePinia(createPinia())
    entrarComo('admin')
    const { tela: admin } = await montar(LayoutLoja)
    expect(enderecos(admin)).toContain('/admin/produtos')
  })

  it('sai e volta para a vitrine', async () => {
    entrarComo('usuario')
    const { tela, router } = await montar(LayoutLoja, '/conta')

    await tela
      .findAll('button')
      .find((b) => b.text().includes('Sair'))!
      .trigger('click')
    await flushPromises()

    expect(servicoAuth.encerrarSessao).toHaveBeenCalledTimes(1)
    expect(useSessao().autenticado).toBe(false)
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('tem link para pular direto ao conteúdo', async () => {
    const { tela } = await montar(LayoutLoja)

    expect(tela.get('.pular').attributes('href')).toBe('#conteudo')
    expect(tela.find('#conteudo').exists()).toBe(true)
  })

  it('avisa a restrição de idade no rodapé', async () => {
    const { tela } = await montar(LayoutLoja)

    expect(tela.text()).toContain('menores de 18 anos')
  })
})

describe('LayoutAdmin', () => {
  it('traz as três seções da gestão e a volta para a loja', async () => {
    entrarComo('admin')

    const { tela } = await montar(LayoutAdmin, '/admin/produtos')

    expect(enderecos(tela)).toEqual(
      expect.arrayContaining(['/admin/produtos', '/admin/pedidos', '/admin/usuarios', '/']),
    )
  })

  it('não mostra carrinho nem conta: são do fluxo de compra', async () => {
    entrarComo('admin')

    const { tela } = await montar(LayoutAdmin, '/admin/produtos')

    expect(enderecos(tela)).not.toContain('/carrinho')
    expect(enderecos(tela)).not.toContain('/conta')
  })

  it('identifica a área para não haver dúvida de onde se está', async () => {
    entrarComo('admin')

    const { tela } = await montar(LayoutAdmin, '/admin/produtos')

    expect(tela.text()).toContain('gestão')
  })

  it('sai da gestão para a vitrine', async () => {
    entrarComo('admin')
    const { tela, router } = await montar(LayoutAdmin, '/admin/produtos')

    await tela
      .findAll('button')
      .find((b) => b.text().includes('Sair'))!
      .trigger('click')
    await flushPromises()

    expect(useSessao().autenticado).toBe(false)
    expect(router.currentRoute.value.path).toBe('/')
  })
})

describe('App', () => {
  it('troca a moldura conforme a rota', async () => {
    entrarComo('admin')
    const router = criarRouter()
    await router.push('/')
    await router.isReady()

    const tela = mount(App, { global: { plugins: [router] } })
    await flushPromises()
    expect(tela.findComponent(LayoutLoja).exists()).toBe(true)

    await router.push('/admin/produtos')
    await flushPromises()

    expect(tela.findComponent(LayoutAdmin).exists()).toBe(true)
    expect(tela.findComponent(LayoutLoja).exists()).toBe(false)
  })
})
