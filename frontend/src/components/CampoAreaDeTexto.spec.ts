import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CampoAreaDeTexto from './CampoAreaDeTexto.vue'

describe('CampoAreaDeTexto', () => {
  it('liga o rótulo à área de texto', () => {
    const campo = mount(CampoAreaDeTexto, { props: { rotulo: 'Descrição', modelValue: '' } })

    expect(campo.get('label').attributes('for')).toBe(campo.get('textarea').attributes('id'))
    expect(campo.get('textarea').attributes('rows')).toBe('4')
  })

  it('devolve o que a pessoa escreveu', async () => {
    const campo = mount(CampoAreaDeTexto, { props: { rotulo: 'Descrição', modelValue: '' } })

    await campo.get('textarea').setValue('Essência de menta.')

    expect(campo.emitted('update:modelValue')?.at(-1)).toEqual(['Essência de menta.'])
  })

  it('anuncia o erro e respeita o limite de tamanho', () => {
    const campo = mount(CampoAreaDeTexto, {
      props: { rotulo: 'Descrição', modelValue: '', erro: 'Longa demais.', maxlength: 2000 },
    })
    const area = campo.get('textarea')

    expect(area.attributes('aria-invalid')).toBe('true')
    expect(area.attributes('maxlength')).toBe('2000')
    expect(campo.text()).toContain('Longa demais.')
  })
})
