import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { umaEntrega } from '@/testes/fixtures'
import EntregaDoPedido from './EntregaDoPedido.vue'

function montar(endereco = umaEntrega(), prazoEmDias = 4) {
  return mount(EntregaDoPedido, { props: { endereco, servico: 'Expresso', prazoEmDias } })
}

describe('EntregaDoPedido', () => {
  it('mostra o endereço com o CEP formatado', () => {
    const bloco = montar()

    expect(bloco.text()).toContain('Praça da Sé, 100')
    expect(bloco.text()).toContain('Sé — São Paulo/SP')
    expect(bloco.text()).toContain('CEP 01001-000')
  })

  it('mostra o complemento só quando existe', () => {
    const com = montar(umaEntrega({ complemento: 'apto 12' }))
    const sem = montar()

    expect(com.text()).toContain('apto 12')
    expect(sem.findAll('br')).toHaveLength(2)
  })

  it('fala de prazo no singular quando é um dia só', () => {
    expect(montar(umaEntrega(), 1).text()).toContain('Expresso, em até 1 dia útil')
    expect(montar(umaEntrega(), 4).text()).toContain('em até 4 dias úteis')
  })
})
