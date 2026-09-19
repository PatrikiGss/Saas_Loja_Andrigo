import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SeloDeStatus from './SeloDeStatus.vue'
import type { StatusPedido } from '../types'

function montar(status: StatusPedido) {
  return mount(SeloDeStatus, { props: { status } })
}

describe('SeloDeStatus', () => {
  it('mostra o texto legível, nunca o identificador', () => {
    expect(montar('em_preparacao').text()).toBe('Em preparação')
    expect(montar('aguardando_pagamento').text()).toBe('Aguardando pagamento')
  })

  it('distingue em andamento, concluído e cancelado pela forma da marca', () => {
    // A cor da loja significa categoria de produto; um status pintado
    // disputaria esse significado. Quem carrega a diferença é a marca.
    expect(montar('pago').classes()).toContain('selo--andamento')
    expect(montar('entregue').classes()).toContain('selo--concluido')
    expect(montar('cancelado').classes()).toContain('selo--cancelado')
  })

  it('esconde a marca do leitor de tela, que já lê o texto', () => {
    expect(montar('pago').get('.selo__marca').attributes('aria-hidden')).toBe('true')
  })
})
