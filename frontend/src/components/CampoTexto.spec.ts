import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CampoTexto from './CampoTexto.vue'

describe('CampoTexto', () => {
  it('liga o rótulo ao campo', () => {
    const campo = mount(CampoTexto, {
      props: { rotulo: 'E-mail', modelValue: '' },
    })

    const id = campo.get('input').attributes('id')

    expect(id).toBeTruthy()
    expect(campo.get('label').attributes('for')).toBe(id)
  })

  it('anuncia o erro e aponta para ele', () => {
    const campo = mount(CampoTexto, {
      props: { rotulo: 'E-mail', modelValue: '', erro: 'E-mail já cadastrado.' },
    })

    const entrada = campo.get('input')

    expect(entrada.attributes('aria-invalid')).toBe('true')
    expect(entrada.attributes('aria-describedby')).toBe(campo.get('.campo__erro').attributes('id'))
    expect(campo.text()).toContain('E-mail já cadastrado.')
  })

  it('mostra a dica quando não há erro, e some com ela quando há', async () => {
    const campo = mount(CampoTexto, {
      props: { rotulo: 'Senha', modelValue: '', dica: 'Mínimo de 8 caracteres.' },
    })

    expect(campo.find('.campo__dica').exists()).toBe(true)

    await campo.setProps({ erro: 'Senha comum demais.' })

    expect(campo.find('.campo__dica').exists()).toBe(false)
    expect(campo.find('.campo__erro').exists()).toBe(true)
  })

  it('não marca aria-invalid quando está válido', () => {
    const campo = mount(CampoTexto, { props: { rotulo: 'Nome', modelValue: '' } })

    expect(campo.get('input').attributes('aria-invalid')).toBeUndefined()
    expect(campo.get('input').attributes('aria-describedby')).toBeUndefined()
  })

  it('devolve o que a pessoa digitou', async () => {
    const campo = mount(CampoTexto, { props: { rotulo: 'Nome', modelValue: '' } })

    await campo.get('input').setValue('Ana')

    expect(campo.emitted('update:modelValue')?.at(-1)).toEqual(['Ana'])
  })
})
