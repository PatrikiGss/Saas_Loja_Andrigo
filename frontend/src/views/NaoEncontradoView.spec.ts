import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import NaoEncontradoView from './NaoEncontradoView.vue'

const Vazio = defineComponent({ setup: () => () => h('div') })

function montar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'inicio', component: Vazio }],
  })
  return mount(NaoEncontradoView, { global: { plugins: [router] } })
}

describe('NaoEncontradoView', () => {
  it('diz o que houve sem falar do sistema por dentro', () => {
    const tela = montar()

    expect(tela.text()).toContain('Esta página não existe.')
    expect(tela.text()).toContain('endereço pode ter mudado')
  })

  it('devolve a pessoa para a loja', () => {
    expect(montar().get('a').attributes('href')).toBe('/')
  })
})
