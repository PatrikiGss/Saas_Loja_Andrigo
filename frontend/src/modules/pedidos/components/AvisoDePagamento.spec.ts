import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { umPedido } from '@/testes/fixtures'
import AvisoDePagamento from './AvisoDePagamento.vue'

describe('AvisoDePagamento', () => {
  it('avisa enquanto o pagamento está pendente', () => {
    const aviso = mount(AvisoDePagamento, {
      props: { pedido: umPedido({ status_pagamento: 'pendente' }) },
    })

    expect(aviso.text()).toContain('pagamento ainda não está disponível')
  })

  it('some quando o pedido é pago', () => {
    // Quando o webhook do gateway começar a marcar pedidos como pagos, o
    // aviso sai de cena sozinho, sem ninguém precisar lembrar de apagá-lo.
    const aviso = mount(AvisoDePagamento, {
      props: { pedido: umPedido({ status_pagamento: 'pago' }) },
    })

    expect(aviso.find('.aviso').exists()).toBe(false)
  })

  it('some também quando o pagamento foi estornado', () => {
    const aviso = mount(AvisoDePagamento, {
      props: { pedido: umPedido({ status_pagamento: 'estornado' }) },
    })

    expect(aviso.find('.aviso').exists()).toBe(false)
  })
})
