import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import CampoSelecao from './CampoSelecao.vue'

function montar(props: Record<string, unknown> = {}) {
  return mount(CampoSelecao, {
    props: { rotulo: 'Estado', modelValue: '', ...props },
    slots: {
      default: () => [
        h('option', { value: 'SP' }, 'São Paulo'),
        h('option', { value: 'RJ' }, 'Rio'),
      ],
    },
  })
}

describe('CampoSelecao', () => {
  it('liga o rótulo à seleção', () => {
    const campo = montar()

    expect(campo.get('label').attributes('for')).toBe(campo.get('select').attributes('id'))
  })

  it('abre no convite, que não pode ser escolhido de volta', () => {
    const convite = montar().findAll('option')[0]

    expect(convite.text()).toBe('Escolha')
    expect(convite.attributes('value')).toBe('')
    expect(convite.attributes('disabled')).toBeDefined()
  })

  it('anuncia o erro e aponta para ele', () => {
    const campo = montar({ erro: 'Faça uma escolha válida.' })
    const selecao = campo.get('select')

    expect(selecao.attributes('aria-invalid')).toBe('true')
    expect(selecao.attributes('aria-describedby')).toBe(campo.get('.campo__erro').attributes('id'))
  })

  it('devolve o que a pessoa escolheu', async () => {
    const campo = montar()

    await campo.get('select').setValue('RJ')

    expect(campo.emitted('update:modelValue')?.at(-1)).toEqual(['RJ'])
  })

  it('marca como obrigatória e trava quando pedido', () => {
    const selecao = montar({ obrigatorio: true, desabilitado: true }).get('select')

    expect(selecao.attributes('required')).toBeDefined()
    expect(selecao.attributes('disabled')).toBeDefined()
  })
})
