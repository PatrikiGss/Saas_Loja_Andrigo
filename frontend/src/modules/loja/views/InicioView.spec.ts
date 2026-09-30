import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import InicioView from './InicioView.vue'
import * as servico from '../services/catalogo'
import type { Subtipo } from '../types'

vi.mock('../services/catalogo')

function subtipo(slug: string, categoria: Subtipo['categoria'], nome: string): Subtipo {
  return {
    slug,
    nome,
    categoria,
    categoria_display: categoria === 'essencia' ? 'Essência' : 'Pod descartável',
    especificacoes:
      categoria === 'essencia' ? ['volume_ml', 'nicotina_mg_ml'] : ['puffs', 'nicotina_mg_ml'],
  }
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'inicio', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
    ],
  })
}

async function montar() {
  const router = criarRouter()
  await router.push('/')
  await router.isReady()

  const tela = mount(InicioView, { global: { plugins: [router] } })
  await flushPromises()
  return tela
}

function erroDeRede(): AxiosError {
  return new AxiosError('falhou', undefined, { headers: new AxiosHeaders() }, {})
}

beforeEach(() => {
  vi.mocked(servico.listarSubtipos)
    .mockReset()
    .mockResolvedValue([
      subtipo('essencia-nic-salt', 'essencia', 'Nic salt'),
      subtipo('essencia-freebase', 'essencia', 'Freebase'),
      subtipo('descartavel-box', 'pod_descartavel', 'Box'),
    ])
})

describe('InicioView', () => {
  it('abre com a parede de cor das categorias', async () => {
    const tela = await montar()

    // Duas categorias, agrupadas a partir dos três subtipos.
    expect(tela.findAll('.familia')).toHaveLength(2)
    expect(tela.text()).toContain('Essência')
    expect(tela.text()).toContain('Pod descartável')
  })

  it('pinta cada família com o matiz da categoria', async () => {
    const tela = await montar()
    const cores = tela.findAll('.familia__cor').map((c) => c.attributes('style') ?? '')

    expect(cores[0]).toContain('var(--cat-essencia)')
    expect(cores[1]).toContain('var(--cat-pod-descartavel)')
  })

  it('leva ao catálogo filtrado pela categoria e pelo subtipo', async () => {
    const tela = await montar()
    const enderecos = tela.findAll('a').map((a) => a.attributes('href'))

    expect(enderecos).toContain('/catalogo?categoria=essencia')
    expect(enderecos).toContain('/catalogo?categoria=essencia&subtipo=essencia-nic-salt')
  })

  it('avisa enquanto carrega', async () => {
    // A busca nunca resolve: a tela fica no estado de espera.
    vi.mocked(servico.listarSubtipos).mockReturnValue(new Promise(() => {}))
    const router = criarRouter()
    const tela = mount(InicioView, { global: { plugins: [router] } })

    // O `carregando` é marcado no `onMounted`, mas o redesenho é agendado.
    await tela.vm.$nextTick()

    expect(tela.text()).toContain('Carregando')
  })

  it('oferece tentar de novo quando a loja não responde', async () => {
    vi.mocked(servico.listarSubtipos).mockRejectedValue(erroDeRede())

    const tela = await montar()

    expect(tela.text()).toContain('Sem resposta da loja')
    expect(tela.findAll('button').some((b) => b.text().includes('Tentar de novo'))).toBe(true)
  })

  it('refaz a busca ao tentar de novo', async () => {
    vi.mocked(servico.listarSubtipos).mockRejectedValueOnce(erroDeRede())
    const tela = await montar()

    await tela
      .findAll('button')
      .find((b) => b.text().includes('Tentar de novo'))!
      .trigger('click')
    await flushPromises()

    expect(tela.findAll('.familia')).toHaveLength(2)
  })

  it('convida a esperar quando o catálogo ainda não tem subtipo', async () => {
    vi.mocked(servico.listarSubtipos).mockResolvedValue([])

    const tela = await montar()

    expect(tela.text()).toContain('catálogo ainda está vazio')
  })
})
