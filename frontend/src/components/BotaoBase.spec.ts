import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BotaoBase from './BotaoBase.vue'

describe('BotaoBase', () => {
  it('bloqueia o clique enquanto carrega, para não enviar duas vezes', async () => {
    const botao = mount(BotaoBase, {
      props: { carregando: true },
      slots: { default: 'Entrar' },
    })

    expect(botao.attributes('disabled')).toBeDefined()
    expect(botao.attributes('aria-busy')).toBe('true')

    await botao.trigger('click')

    expect(botao.emitted('click')).toBeUndefined()
  })

  it('emite clique quando está livre', async () => {
    const botao = mount(BotaoBase, { slots: { default: 'Entrar' } })

    await botao.trigger('click')

    expect(botao.emitted('click')).toHaveLength(1)
  })

  it('não emite clique quando desabilitado', async () => {
    const botao = mount(BotaoBase, { props: { desabilitado: true } })

    await botao.trigger('click')

    expect(botao.emitted('click')).toBeUndefined()
  })

  it('nasce como botão comum, e não como submit', () => {
    expect(mount(BotaoBase).attributes('type')).toBe('button')
    expect(mount(BotaoBase, { props: { tipo: 'submit' } }).attributes('type')).toBe('submit')
  })
})
