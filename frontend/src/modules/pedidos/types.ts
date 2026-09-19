/** Formas que a app `pedidos` devolve. Nada aqui é gravável pela API. */

/** `StatusPedido.choices`. Quem move o pedido no fluxo é o backend. */
export type StatusPedido =
  | 'aguardando_pagamento'
  | 'pago'
  | 'em_preparacao'
  | 'enviado'
  | 'entregue'
  | 'cancelado'

/** `StatusPagamento.choices`. */
export type StatusPagamento = 'pendente' | 'pago' | 'estornado'

/** `ServicoFrete.choices`. */
export type ServicoFrete = 'economico' | 'expresso'

/** Linha da compra, com nome e preço congelados no fechamento. */
export interface ItemPedido {
  sku: string
  nome: string
  preco_unitario: string
  quantidade: number
  subtotal: string
}

/** Cópia do endereço como ele estava no dia da compra. */
export interface EnderecoDeEntrega {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

/** Resposta de `POST /api/checkout/` e de `/api/pedidos/`. */
export interface Pedido {
  numero: string
  status: StatusPedido
  status_pagamento: StatusPagamento
  itens: ItemPedido[]
  entrega: EnderecoDeEntrega
  servico_frete: ServicoFrete
  prazo_frete_em_dias: number
  subtotal: string
  frete: string
  total: string
  criado_em: string
  pago_em: string | null
}

/**
 * Texto de cada valor que o backend devolve como identificador.
 *
 * São espelhos dos `TextChoices` do Django. O `.label` deles não vem na API —
 * o serializer manda só o valor — e a interface não pode mostrar
 * `em_preparacao` para ninguém. Se um status novo aparecer no backend, a
 * função `textoDoStatus` devolve o identificador em vez de quebrar a tela.
 */
export const TEXTO_DO_STATUS: Record<StatusPedido, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_preparacao: 'Em preparação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const TEXTO_DO_PAGAMENTO: Record<StatusPagamento, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  estornado: 'Estornado',
}

export const TEXTO_DO_SERVICO: Record<ServicoFrete, string> = {
  economico: 'Econômico',
  expresso: 'Expresso',
}

export function textoDoStatus(status: StatusPedido): string {
  return TEXTO_DO_STATUS[status] ?? status
}

export function textoDoServico(servico: ServicoFrete): string {
  return TEXTO_DO_SERVICO[servico] ?? servico
}

/**
 * O caminho normal do pedido, na ordem em que ele acontece.
 *
 * Espelha as transições de `pedidos.models.TRANSICOES`. Cancelado não entra:
 * ele é saída, pode acontecer em quase qualquer ponto, e desenhá-lo como
 * etapa sugeriria que todo pedido passa por lá.
 */
export const FLUXO: readonly StatusPedido[] = [
  'aguardando_pagamento',
  'pago',
  'em_preparacao',
  'enviado',
  'entregue',
]
