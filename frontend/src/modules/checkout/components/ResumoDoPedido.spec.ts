import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ErroDaApi } from '@/services/erros'
import type { ItemCarrinho } from '@/modules/carrinho/types'
import type { Endereco } from '@/modules/enderecos/types'
import ResumoDoPedido from './ResumoDoPedido.vue'
import type { OpcaoFrete } from '../types'

const ITEM: ItemCarrinho = {
  id: 1,
  produto: {
    id: 'p1',
    sku: 'SKU-1',
    nome: 'Pod de menta',
    preco: '49.90',
    categoria: 'pod_descartavel',
    disponivel: true,
  },
  quantidade: 2,
  subtotal: '99.80',
}

const ENDERECO: Endereco = {
  id: 1,
  apelido: 'Casa',
  cep: '01001000',
  logradouro: 'Praça da Sé',
  numero: '100',
  complemento: '',
  bairro: 'Sé',
  cidade: 'São Paulo',
  uf: 'SP',
}

const FRETE: OpcaoFrete = {
  servico: 'economico',
  nome: 'Econômico',
  preco: '22.40',
  prazo_em_dias: 4,
}

function montar(extra: Record<string, unknown> = {}) {
  return mount(ResumoDoPedido, {
    props: {
      itens: [ITEM],
      subtotal: '99.80',
      endereco: ENDERECO,
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
