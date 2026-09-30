/**
 * Gestão do catálogo. Todas as rotas daqui exigem conta administrativa.
 *
 * A listagem é a mesma `/api/produtos/` do cliente: quando quem pergunta é
 * admin, o backend deixa de filtrar por `ativo` e troca o serializer por um
 * que traz estoque e situação. Não existe endpoint separado, e inventar um
 * caminho `/admin/` aqui só criaria um 404.
 */
import { http } from '@/services/http'
import type { FiltrosDoCatalogo } from '@/modules/loja/types'
import { comoQuery } from '@/modules/loja/services/catalogo'
import type { Esquema, Paginado } from '@/types/api'
import type { DadosDeProduto, ProdutoGestao } from '../types'

export async function listarProdutos(
  filtros: FiltrosDoCatalogo = {},
): Promise<Paginado<ProdutoGestao>> {
  const { data } = await http.get<Paginado<ProdutoGestao>>('/produtos/', {
    params: comoQuery(filtros),
  })
  return data
}

export async function buscarProduto(id: string): Promise<ProdutoGestao> {
  const { data } = await http.get<ProdutoGestao>(`/produtos/${id}/`)
  return data
}

export async function criarProduto(dados: DadosDeProduto): Promise<ProdutoGestao> {
  const { data } = await http.post<ProdutoGestao>('/produtos/', dados)
  return data
}

export async function atualizarProduto(id: string, dados: DadosDeProduto): Promise<ProdutoGestao> {
  const { data } = await http.put<ProdutoGestao>(`/produtos/${id}/`, dados)
  return data
}

/**
 * `DELETE /api/produtos/<id>/`.
 *
 * Produto com histórico é protegido no banco e volta 409: quem já foi
 * comprado ou está em algum carrinho não se apaga, desativa.
 */
export async function removerProduto(id: string): Promise<void> {
  await http.delete(`/produtos/${id}/`)
}

/**
 * `POST /api/produtos/<id>/estoque/` — positivo repõe, negativo dá baixa.
 *
 * Devolve o estoque resultante, calculado pelo banco. A baixa maior que o
 * disponível é recusada com 400.
 */
export async function ajustarEstoque(id: string, delta: number): Promise<number> {
  const { data } = await http.post<Esquema<'EstoqueAjustado'>>(`/produtos/${id}/estoque/`, {
    delta,
  } satisfies Esquema<'AjusteEstoqueRequest'>)
  return data.estoque
}
