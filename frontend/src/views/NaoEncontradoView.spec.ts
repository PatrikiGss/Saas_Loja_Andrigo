import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { roteadorDeTeste } from '@/testes/roteador'
import NaoEncontradoView from './NaoEncontradoView.vue'

function montar() {
  return mount(NaoEncontradoView, { global: { plugins: [roteadorDeTeste({ inicio: '/' })] } })
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
