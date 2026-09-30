import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AvisoDePagamento from './AvisoDePagamento.vue'
import type { Pedido, StatusPagamento } from '../types'

function pedido(status_pagamento: StatusPagamento): Pedido {
  return {
    numero: 'PED-20260919-ABCDEF',
    status: 'aguardando_pagamento',
    status_pagamento,
    itens: [],
    entrega: {
      cep: '01001000',
      logradouro: 'Praça da Sé',
      numero: '100',
      complemento: '',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    },
    servico_frete: 'economico',
    prazo_frete_em_dias: 4,
    subtotal: '69.90',
    frete: '19.90',
    total: '89.80',
    criado_em: '2026-09-19T00:09:00Z',
    pago_em: null,
    cliente: 'ana@example.com',
    proximos_status: ['pago', 'cancelado'],
    pode_cancelar: true,
  }
}

describe('AvisoDePagamento', () => {
  it('avisa enquanto o pagamento está pendente', () => {
    const aviso = mount(AvisoDePagamento, { props: { pedido: pedido('pendente') } })

    expect(aviso.text()).toContain('pagamento ainda não está disponível')
  })

  it('some quando o pedido é pago', () => {
    // Quando o webhook do gateway começar a marcar pedidos como pagos, o
    // aviso sai de cena sozinho, sem ninguém precisar lembrar de apagá-lo.
    const aviso = mount(AvisoDePagamento, { props: { pedido: pedido('pago') } })

    expect(aviso.find('.aviso').exists()).toBe(false)
  })

  it('some também quando o pagamento foi estornado', () => {
    const aviso = mount(AvisoDePagamento, { props: { pedido: pedido('estornado') } })

    expect(aviso.find('.aviso').exists()).toBe(false)
  })
})
