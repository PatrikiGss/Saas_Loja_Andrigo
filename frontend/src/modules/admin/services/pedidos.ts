/**
 * Movimentação de pedidos pela equipe.
 *
 * A leitura é a mesma `/api/pedidos/` do cliente — quando quem pergunta é
 * admin, o backend para de filtrar por dono. Só a mudança de status é
 * exclusiva daqui.
 */
import { http } from '@/services/http'
import type { Pedido, StatusPedido } from '@/modules/pedidos/types'
import type { Esquema } from '@/types/api'

/**
 * `POST /api/pedidos/<numero>/status/`.
 *
 * O backend só aceita transição prevista; o que não está no fluxo volta com
 * 400 e a mensagem dizendo de onde para onde não dá.
 */
export async function alterarStatus(numero: string, status: StatusPedido): Promise<Pedido> {
  const { data } = await http.post<Pedido>(`/pedidos/${numero}/status/`, {
    status,
  } satisfies Esquema<'AlteracaoStatusRequest'>)
  return data
}
