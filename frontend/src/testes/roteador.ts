/**
 * Roteador de memória para os testes que montam telas.
 *
 * As telas navegam pelo nome da rota; o teste declara só as rotas que a tela
 * usa, e cada uma leva a um componente vazio. Assim a lista de rotas do teste
 * diz de quais a tela depende, sem carregar as views de verdade.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type RouteMeta, type Router } from 'vue-router'

const Vazio = defineComponent({ setup: () => () => h('div') })

/** Caminho da rota, ou caminho e meta quando o teste passa pelas guardas. */
type Rotas = Record<string, string | { caminho: string; meta: RouteMeta }>

export function roteadorDeTeste(rotas: Rotas): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: Object.entries(rotas).map(([name, rota]) =>
      typeof rota === 'string'
        ? { name, path: rota, component: Vazio }
        : { name, path: rota.caminho, meta: rota.meta, component: Vazio },
    ),
  })
}

interface Opcoes {
  props?: Record<string, unknown>
  slots?: Record<string, string>
  attachTo?: HTMLElement
}

/**
 * Leva o roteador até `caminho`, monta o componente com ele e espera o que o
 * componente busca ao montar.
 */
export async function montarNaRota(
  componente: Component,
  caminho: string,
  rotas: Rotas,
  opcoes: Opcoes = {},
) {
  const router = roteadorDeTeste(rotas)
  await router.push(caminho)
  await router.isReady()

  const tela = mount(componente, { ...opcoes, global: { plugins: [router] } })
  await flushPromises()
  return { tela, router }
}
