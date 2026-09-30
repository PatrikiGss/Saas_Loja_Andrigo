import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EntregaDoPedido from './EntregaDoPedido.vue'
import type { Pedido } from '../types'

function pedido(complemento: string, prazo: number): Pedido {
  return {
    numero: 'PED-1',
    cliente: 'ana@example.com',
    status: 'aguardando_pagamento',
    status_pagamento: 'pendente',
    itens: [],
    entrega: {
      cep: '01001000',
      logradouro: 'Praça da Sé',
      numero: '100',
      complemento,
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    },
    servico_frete: 'expresso',
    prazo_frete_em_dias: prazo,
    subtotal: '49.90',
    frete: '35.82',
    total: '85.72',
    criado_em: '2026-09-19T00:00:00Z',
    pago_em: null,
    proximos_status: ['pago', 'cancelado'],
    pode_cancelar: true,
  }
}

describe('EntregaDoPedido', () => {
  it('mostra o endereço congelado, com o CEP formatado', () => {
    const entrega = mount(EntregaDoPedido, { props: { pedido: pedido('', 4) } })

    expect(entrega.text()).toContain('Praça da Sé, 100')
    expect(entrega.text()).toContain('Sé — São Paulo/SP')
    expect(entrega.text()).toContain('CEP 01001-000')
  })

  it('mostra o complemento só quando existe', () => {
    const com = mount(EntregaDoPedido, { props: { pedido: pedido('apto 12', 4) } })
    const sem = mount(EntregaDoPedido, { props: { pedido: pedido('', 4) } })

    expect(com.text()).toContain('apto 12')
    expect(sem.findAll('br')).toHaveLength(2)
  })

  it('fala de prazo no singular quando é um dia só', () => {
    const umDia = mount(EntregaDoPedido, { props: { pedido: pedido('', 1) } })
    const quatro = mount(EntregaDoPedido, { props: { pedido: pedido('', 4) } })

    expect(umDia.text()).toContain('Expresso, em até 1 dia útil')
    expect(quatro.text()).toContain('em até 4 dias úteis')
  })
})
