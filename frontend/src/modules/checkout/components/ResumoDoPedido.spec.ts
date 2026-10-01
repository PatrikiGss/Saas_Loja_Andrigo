import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ErroDaApi } from '@/services/erros'
import { umEndereco, umItemDeCarrinho } from '@/testes/fixtures'
import ResumoDoPedido from './ResumoDoPedido.vue'
import type { OpcaoFrete } from '../types'

const FRETE: OpcaoFrete = {
  servico: 'economico',
  nome: 'Econômico',
  preco: '22.40',
  prazo_em_dias: 4,
}

function montar(extra: Record<string, unknown> = {}) {
  return mount(ResumoDoPedido, {
    props: {
      itens: [umItemDeCarrinho()],
      subtotal: '99.80',
      endereco: umEndereco(),
      frete: FRETE,
      fechando: false,
      erro: null,
      ...extra,
    },
  })
}

describe('ResumoDoPedido', () => {
  it('soma subtotal e frete sem erro de centavo', () => {
    const resumo = montar()

    // 99.80 + 22.40; em ponto flutuante daria 122.19999999999999.
    expect(resumo.text()).toContain('122,20')
  })

  it('mostra subtotal e frete em linhas próprias, como o servidor os devolveu', () => {
    const resumo = montar()

    expect(resumo.text()).toContain('99,80')
    expect(resumo.text()).toContain('22,40')
  })

  it('formata o CEP e monta o destino', () => {
    const resumo = montar()

    expect(resumo.text()).toContain('01001-000')
    expect(resumo.text()).toContain('São Paulo/SP')
  })

  it('diz que o pagamento ainda não existe, em vez de prometer uma etapa', () => {
    const resumo = montar()

    expect(resumo.text()).toContain('pagamento ainda não está disponível')
  })

  it('prefere a recusa de domínio à mensagem genérica', () => {
    const erro = new ErroDaApi('validacao', 'Confira os campos destacados.', 400, {
      pedido: 'Há pedidos demais aguardando pagamento nesta conta.',
    })

    const resumo = montar({ erro })

    expect(resumo.text()).toContain('Há pedidos demais aguardando pagamento')
  })

  it('trava o botão enquanto fecha, para não sair pedido em dobro', () => {
    const resumo = montar({ fechando: true })
    const fechar = resumo.findAll('button').find((b) => b.text().includes('Fechar pedido'))

    expect(fechar!.attributes('disabled')).toBeDefined()
  })

  it('pede o fechamento uma vez por clique', async () => {
    const resumo = montar()
    const fechar = resumo.findAll('button').find((b) => b.text().includes('Fechar pedido'))

    await fechar!.trigger('click')

    expect(resumo.emitted('fechar')).toHaveLength(1)
  })
})
