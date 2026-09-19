/**
 * Serviço do fechamento do pedido.
 *
 * Os dois endpoints daqui recebem o mínimo: um id de endereço e, no
 * fechamento, o identificador do serviço de frete. Preço, prazo, subtotal e
 * total são recalculados no servidor a partir disso — nenhum valor de dinheiro
 * sai desta máquina.
 */
import { http } from '@/services/http'
import type { Pedido, ServicoFrete } from '@/modules/pedidos/types'
import type { OpcaoFrete } from '../types'

/**
 * `POST /api/frete/cotacao/` — exige carrinho com itens.
 *
 * Recusa com `{carrinho: 'Carrinho vazio.'}` ou
 * `{endereco: 'Não há entrega para esse estado.'}`.
 */
export async function cotarFrete(endereco: number): Promise<OpcaoFrete[]> {
  const { data } = await http.post<OpcaoFrete[]>('/frete/cotacao/', { endereco })
  return data
}

/**
 * `POST /api/checkout/` — converte o carrinho em pedido.
 *
 * O pedido volta inteiro, com os valores oficiais. Também esvazia o carrinho
 * no servidor, então quem chamar isto precisa recarregar o carrinho local.
 */
export async function fecharPedido(endereco: number, servico: ServicoFrete): Promise<Pedido> {
  const { data } = await http.post<Pedido>('/checkout/', { endereco, servico })
  return data
}
