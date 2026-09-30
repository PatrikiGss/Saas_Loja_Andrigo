import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import DialogoDeConfirmacao from './DialogoDeConfirmacao.vue'

// O jsdom não implementa showModal/close do <dialog>; aqui eles só precisam
// registrar o estado para o componente reagir.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

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
})
