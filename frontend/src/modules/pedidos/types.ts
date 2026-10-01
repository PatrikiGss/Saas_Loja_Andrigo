/** Formas que a app `pedidos` devolve, geradas do esquema. */
import type { Esquema } from '@/types/api'

/** Quem move o pedido no fluxo é o backend. */
export type StatusPedido = Esquema<'StatusPedidoEnum'>

export type StatusPagamento = Esquema<'StatusPagamentoEnum'>

export type ServicoFrete = Esquema<'ServicoFreteEnum'>

/** Linha da compra, com nome e preço congelados no fechamento. */
export type ItemPedido = Esquema<'ItemPedido'>

/**
 * Endereço de entrega. No pedido é a cópia congelada no fechamento; o
 * endereço do cadastro tem a mesma forma, e serve para o resumo antes dele.
 */
export type EnderecoDeEntrega = Esquema<'EnderecoDeEntrega'>

/**
 * Resposta de `POST /api/checkout/` e de `/api/pedidos/`. Nada é gravável, e
 * a `entrega` é a cópia do endereço como ele estava no dia da compra.
 */
export type Pedido = Esquema<'Pedido'>

/**
 * Mínimo de que as telas de pedido dependem.
 *
 * Não é o serializer inteiro: é o que precisa estar lá para a confirmação, o
 * histórico e o acompanhamento desenharem sem inventar valor.
 */
export const CAMPOS_DO_PEDIDO = [
  'numero',
  'status',
  'status_pagamento',
  'itens',
  'entrega',
  'subtotal',
  'frete',
  'total',
] as const

/**
 * Texto de cada valor que o backend devolve como identificador.
 *
 * O esquema traz os valores dos `TextChoices`, mas não o `.label` — o
 * serializer manda só o valor —, e a interface não pode mostrar
 * `em_preparacao` para ninguém. Os textos ficam aqui, mas as chaves vêm do
 * esquema: um status novo no backend quebra a compilação até ganhar texto.
 *
 * O `?? status` das funções abaixo continua valendo para outro caso: o
 * backend publicado antes deste frontend. Aí a tela mostra o identificador em
 * vez de quebrar.
 */
const TEXTO_DO_STATUS: Record<StatusPedido, string> = {
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

const TEXTO_DO_SERVICO: Record<ServicoFrete, string> = {
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
