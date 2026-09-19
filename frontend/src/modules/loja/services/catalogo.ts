/**
 * Serviço do catálogo.
 *
 * Nenhum componente monta caminho de API nem nome de parâmetro: quem conhece
 * as rotas e a query da app `loja` é este arquivo.
 */
import { objetoCom, paginaDe } from '@/services/conferencia'
import { http } from '@/services/http'
import { coletarTudo } from '@/services/paginacao'
import type { Paginado } from '@/types/api'
import type { FiltrosDoCatalogo, Produto, Subtipo } from '../types'

/** Mínimo para desenhar um card: identidade, cor, nome e preço. */
const CAMPOS_DO_PRODUTO = ['id', 'sku', 'nome', 'preco', 'categoria', 'em_estoque'] as const

/**
 * `GET /api/subtipos/` — público.
 *
 * Vem paginado de 20 em 20, e a interface precisa da lista inteira para montar
 * os filtros, então percorre as páginas.
 */
export function listarSubtipos(): Promise<Subtipo[]> {
  return coletarTudo<Subtipo>('/subtipos/', ['slug', 'nome', 'categoria', 'categoria_display'])
}

/**
 * Traduz os filtros da tela para a query que o backend entende.
 *
 * `busca` vira `search` e `ordem` vira `ordering` porque são os nomes do
 * `SearchFilter` e do `OrderingFilter` do DRF. Filtro vazio não entra na
 * query: `?categoria=` seria recusado com 400 por categoria inválida.
 */
export function comoQuery(filtros: FiltrosDoCatalogo): Record<string, string> {
  const query: Record<string, string> = {}

  if (filtros.categoria) query.categoria = filtros.categoria
  if (filtros.subtipo) query.subtipo = filtros.subtipo
  if (filtros.busca?.trim()) query.search = filtros.busca.trim()
  if (filtros.ordem) query.ordering = filtros.ordem
  if (filtros.pagina && filtros.pagina > 1) query.page = String(filtros.pagina)

  return query
}

/** `GET /api/produtos/` — público, 20 por página. */
export async function listarProdutos(
  filtros: FiltrosDoCatalogo = {},
): Promise<Paginado<Produto>> {
  const { data } = await http.get<Paginado<Produto>>('/produtos/', {
    params: comoQuery(filtros),
  })
  return paginaDe<Produto>(data, CAMPOS_DO_PRODUTO)
}

/** `GET /api/produtos/<id>/` — público. Produto inativo responde 404. */
export async function buscarProduto(id: string): Promise<Produto> {
  const { data } = await http.get<Produto>(`/produtos/${id}/`)
  return objetoCom<Produto>(data, CAMPOS_DO_PRODUTO)
}
