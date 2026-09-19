import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AcompanhamentoDoPedido from './AcompanhamentoDoPedido.vue'
import { FLUXO, type StatusPedido } from '../types'

function montar(status: StatusPedido) {
  return mount(AcompanhamentoDoPedido, { props: { status } })
}

/** Estado de cada etapa, na ordem do percurso. */
function estados(trilha: ReturnType<typeof montar>): string[] {
  return trilha.findAll('.etapa').map((etapa) => {
    if (etapa.classes('etapa--cumprido')) return 'cumprido'
    if (etapa.classes('etapa--atual')) return 'atual'
    return 'futuro'
  })
}

describe('AcompanhamentoDoPedido', () => {
  it('desenha o percurso inteiro, do pagamento à entrega', () => {
    const trilha = montar('aguardando_pagamento')

    expect(trilha.findAll('.etapa')).toHaveLength(FLUXO.length)
  })

  it('marca o que já passou, onde está e o que falta', () => {
    expect(estados(montar('aguardando_pagamento'))).toEqual([
      'atual',
      'futuro',
      'futuro',
      'futuro',
      'futuro',
    ])

    expect(estados(montar('enviado'))).toEqual([
      'cumprido',
      'cumprido',
      'cumprido',
      'atual',
      'futuro',
    ])
  })

  it('fecha o percurso quando o pedido chega', () => {
    expect(estados(montar('entregue'))).toEqual([
      'cumprido',
      'cumprido',
      'cumprido',
      'cumprido',
      'atual',
    ])
  })

  it('não desenha percurso para pedido cancelado', () => {
    // Cancelado é saída, não etapa: mostrar cinco pontos sugeriria que ainda
    // faltava caminho.
    const trilha = montar('cancelado')

    expect(trilha.findAll('.etapa')).toHaveLength(0)
    expect(trilha.text()).toContain('Cancelado')
    expect(trilha.text()).toContain('não segue para entrega')
  })

  it('anuncia a etapa atual para quem usa leitor de tela', () => {
    const trilha = montar('pago')
    const atual = trilha.get('.etapa--atual')

    expect(atual.attributes('aria-current')).toBe('step')
    expect(atual.text()).toContain('etapa atual')
  })

  it('mostra o texto legível, nunca o identificador do backend', () => {
    expect(montar('em_preparacao').text()).toContain('Em preparação')
    expect(montar('em_preparacao').text()).not.toContain('em_preparacao')
  })
})
