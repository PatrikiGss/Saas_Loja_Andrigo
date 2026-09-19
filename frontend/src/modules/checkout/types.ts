/** Formas do fechamento do pedido. */
import type { ServicoFrete } from '@/modules/pedidos/types'

/** Uma opção de entrega, como `POST /api/frete/cotacao/` devolve. */
export interface OpcaoFrete {
  servico: ServicoFrete
  nome: string
  preco: string
  prazo_em_dias: number
}

/** Os passos do fechamento, na ordem em que acontecem. */
export type Passo = 'endereco' | 'entrega' | 'resumo'

export const PASSOS: ReadonlyArray<{ id: Passo; texto: string }> = [
  { id: 'endereco', texto: 'Endereço' },
  { id: 'entrega', texto: 'Entrega' },
  { id: 'resumo', texto: 'Resumo' },
]
