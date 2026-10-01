import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DialogoDeConfirmacao from './DialogoDeConfirmacao.vue'

function montar(props: Partial<InstanceType<typeof DialogoDeConfirmacao>['$props']> = {}) {
  return mount(DialogoDeConfirmacao, {
    props: {
      aberto: false,
      titulo: 'Limpar o carrinho?',
      confirmar: 'Limpar carrinho',
      ...props,
    },
    attachTo: document.body,
  })
}

describe('DialogoDeConfirmacao', () => {
  it('abre e fecha conforme o estado de quem o usa', async () => {
    const dialogo = montar()
    const elemento = dialogo.get('dialog').element as HTMLDialogElement

    expect(elemento.open).toBe(false)

    await dialogo.setProps({ aberto: true })
    expect(elemento.open).toBe(true)

    await dialogo.setProps({ aberto: false })
    expect(elemento.open).toBe(false)
  })

  it('usa o nome da ação no botão, e não um "ok" genérico', async () => {
    const dialogo = montar({ aberto: true })

    expect(dialogo.text()).toContain('Limpar carrinho')
  })

  it('emite confirmar e cancelar', async () => {
    const dialogo = montar({ aberto: true })
    const [cancelar, confirmar] = dialogo.findAll('button')

    await confirmar.trigger('click')
    await cancelar.trigger('click')

    expect(dialogo.emitted('confirmar')).toHaveLength(1)
    expect(dialogo.emitted('cancelar')).toHaveLength(1)
  })

  it('trata o fechamento pelo Escape como cancelamento', async () => {
    const dialogo = montar({ aberto: true })

    ;(dialogo.get('dialog').element as HTMLDialogElement).close()
    await dialogo.vm.$nextTick()

    expect(dialogo.emitted('cancelar')).toHaveLength(1)
  })

  it('não cancela sozinho enquanto a ação está em andamento', async () => {
    const dialogo = montar({ aberto: true, processando: true })

    ;(dialogo.get('dialog').element as HTMLDialogElement).close()
    await dialogo.vm.$nextTick()

    expect(dialogo.emitted('cancelar')).toBeUndefined()
  })

  it('trava o cancelar enquanto confirma', () => {
    const dialogo = montar({ aberto: true, processando: true })
    const [cancelar] = dialogo.findAll('button')

    expect(cancelar.attributes('disabled')).toBeDefined()
  })

  it('abre quando já monta aberto', async () => {
    // A pergunta de idade monta com a resposta já pendente.
    const dialogo = montar({ aberto: true })
    await flushPromises()

    expect((dialogo.get('dialog').element as HTMLDialogElement).open).toBe(true)
  })

  it('tem nome e descrição para o leitor de tela', () => {
    const dialogo = montar({ descricao: 'Não dá para desfazer.' })
    const caixa = dialogo.get('dialog')

    // Pelo id, e não por seletor: o `useId` do Vue não promete id que sirva
    // de seletor de CSS.
    const nome = document.getElementById(caixa.attributes('aria-labelledby')!)
    const descricao = document.getElementById(caixa.attributes('aria-describedby')!)
    expect(nome?.textContent).toBe('Limpar o carrinho?')
    expect(descricao?.textContent).toBe('Não dá para desfazer.')
    dialogo.unmount()
  })

  it('exigindo resposta, não fecha com Escape e abre o foco na pergunta', async () => {
    const dialogo = montar({ aberto: true, exigeResposta: true })
    await flushPromises()

    const escape = new Event('cancel', { cancelable: true })
    dialogo.get('dialog').element.dispatchEvent(escape)
    await flushPromises()

    expect(escape.defaultPrevented).toBe(true)
    expect(dialogo.emitted('cancelar')).toBeUndefined()
    expect(document.activeElement).toBe(dialogo.get('h2').element)
    dialogo.unmount()
  })
})
