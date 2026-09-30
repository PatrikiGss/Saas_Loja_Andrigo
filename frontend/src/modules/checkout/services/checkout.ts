/**
 * Serviço do fechamento do pedido.
 *
 * Os dois endpoints daqui recebem o mínimo: um id de endereço e, no
 * fechamento, o identificador do serviço de frete. Preço, prazo, subtotal e
 * total são recalculados no servidor a partir disso — nenhum valor de dinheiro
 * sai desta máquina.
 */
import { listaDe, objetoCom } from '@/services/conferencia'
import { http } from '@/services/http'
import { CAMPOS_DO_PEDIDO, type Pedido, type ServicoFrete } from '@/modules/pedidos/types'
import type { Esquema } from '@/types/api'
import type { OpcaoFrete } from '../types'

/**
 * `POST /api/frete/cotacao/` — exige carrinho com itens.
 *
 * Recusa com `{carrinho: 'Carrinho vazio.'}` ou
 * `{endereco: 'Não há entrega para esse estado.'}`.
 */
export async function cotarFrete(endereco: number): Promise<OpcaoFrete[]> {
  const { data } = await http.post<OpcaoFrete[]>('/frete/cotacao/', {
    endereco,
  } satisfies Esquema<'CotacaoFreteRequest'>)
  // `servico` é o que vai no fechamento; `preco` e `prazo_em_dias` são o que
  // a pessoa lê para escolher.
  return listaDe<OpcaoFrete>(data, ['servico', 'nome', 'preco', 'prazo_em_dias'])
}

/**
 * `POST /api/checkout/` — converte o carrinho em pedido.
 *
 * O pedido volta inteiro, com os valores oficiais. Também esvazia o carrinho
 * no servidor, então quem chamar isto precisa recarregar o carrinho local.
 */
export async function fecharPedido(endereco: number, servico: ServicoFrete): Promise<Pedido> {
  const { data } = await http.post<Pedido>('/checkout/', {
    endereco,
    servico,
  } satisfies Esquema<'CheckoutRequest'>)
  return objetoCom<Pedido>(data, CAMPOS_DO_PEDIDO)
}
