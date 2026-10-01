import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sairDoSite } from '../sair'
import { useIdade } from '../stores/idade'
import PerguntaDeIdade from './PerguntaDeIdade.vue'

vi.mock('../sair')

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(sairDoSite).mockReset()
  setActivePinia(createPinia())
})

async function montarPerguntando(momento: 'entrada' | 'compra') {
  const idade = useIdade()
  const resposta = idade.confirmar(momento)
  const tela = mount(PerguntaDeIdade, { attachTo: document.body })
  await flushPromises()
  return { tela, idade, resposta }
}

function botao(tela: Awaited<ReturnType<typeof montarPerguntando>>['tela'], texto: string) {
  return tela.findAll('button').find((item) => item.text().startsWith(texto))!
}

describe('PerguntaDeIdade', () => {
  it('fica fechada enquanto ninguém pergunta', () => {
    const tela = mount(PerguntaDeIdade)

    expect(tela.get('dialog').attributes('open')).toBeUndefined()
  })

  it('abre com a pergunta, e o foco nela e não num botão', async () => {
    const { tela } = await montarPerguntando('entrada')

    expect(tela.get('dialog').attributes('open')).toBeDefined()
    expect(tela.get('h2').text()).toBe('Você tem 18 anos ou mais?')
    // Um Enter distraído não responde por ninguém.
    expect(document.activeElement).toBe(tela.get('h2').element)
    tela.unmount()
  })

  it('no carrinho, avisa que é a segunda vez', async () => {
    const { tela } = await montarPerguntando('compra')

    expect(tela.text()).toContain('Antes do carrinho, confirmamos de novo.')
    tela.unmount()
  })

  it('com sim, libera e fecha', async () => {
    const { tela, resposta } = await montarPerguntando('entrada')

    await botao(tela, 'Sim').trigger('click')
    await flushPromises()

    await expect(resposta).resolves.toBe(true)
    expect(tela.get('dialog').attributes('open')).toBeUndefined()
    tela.unmount()
  })

  it('com não, tira a pessoa do site', async () => {
    const { tela, resposta } = await montarPerguntando('entrada')

    await botao(tela, 'Não').trigger('click')

    expect(sairDoSite).toHaveBeenCalledOnce()
    await expect(resposta).resolves.toBe(false)
    tela.unmount()
  })

  it('não fecha com Escape: sem resposta não há como seguir', async () => {
    const { tela, idade } = await montarPerguntando('entrada')

    const cancelamento = new Event('cancel', { cancelable: true })
    tela.get('dialog').element.dispatchEvent(cancelamento)
    await flushPromises()

    expect(cancelamento.defaultPrevented).toBe(true)
    expect(idade.pergunta).toBe('entrada')
    tela.unmount()
  })
})
