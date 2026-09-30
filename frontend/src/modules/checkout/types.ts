/** Formas do fechamento do pedido. */
import type { Esquema } from '@/types/api'

/** Uma opção de entrega, como `POST /api/frete/cotacao/` devolve. */
export type OpcaoFrete = Esquema<'OpcaoFrete'>

/** Os passos do fechamento, na ordem em que acontecem. */
export type Passo = 'endereco' | 'entrega' | 'resumo'

export const PASSOS: ReadonlyArray<{ id: Passo; texto: string }> = [
  { id: 'endereco', texto: 'Endereço' },
  { id: 'entrega', texto: 'Entrega' },
  { id: 'resumo', texto: 'Resumo' },
]
