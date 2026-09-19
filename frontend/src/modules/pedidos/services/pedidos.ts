/**
 * Serviço de pedidos. Somente leitura: nada aqui é gravável pela API.
 *
 * A consulta do backend já nasce restrita — o cliente enxerga os pedidos
 * dele, e conta admin enxerga todos. Pedido de outra pessoa não existe na
 * consulta e responde 404, então não há verificação de dono para fazer aqui.
 */
import { objetoCom, paginaDe } from '@/services/conferencia'
import { http } from '@/services/http'
import type { Paginado } from '@/types/api'
import { CAMPOS_DO_PEDIDO, type Pedido } from '../types'

/** `GET /api/pedidos/` — 20 por página, do mais recente para o mais antigo. */
export async function listarPedidos(pagina = 1): Promise<Paginado<Pedido>> {
  const { data } = await http.get<Paginado<Pedido>>('/pedidos/', {
    params: pagina > 1 ? { page: String(pagina) } : {},
  })
  return paginaDe<Pedido>(data, CAMPOS_DO_PEDIDO)
}

/** `GET /api/pedidos/<numero>/` — o número é a chave, não o id. */
export async function buscarPedido(numero: string): Promise<Pedido> {
  const { data } = await http.get<Pedido>(`/pedidos/${numero}/`)
  return objetoCom<Pedido>(data, CAMPOS_DO_PEDIDO)
}
