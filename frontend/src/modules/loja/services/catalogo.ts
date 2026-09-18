/**
 * Serviço do catálogo.
 *
 * Nenhum componente monta caminho de API: quem conhece as rotas da app `loja`
 * é este arquivo.
 */
import { coletarTudo } from '@/services/paginacao'
import type { Subtipo } from '../types'

/**
 * `GET /api/subtipos/` — público.
 *
 * Vem paginado de 20 em 20, e a interface precisa da lista inteira para montar
 * os filtros, então percorre as páginas.
 */
export function listarSubtipos(): Promise<Subtipo[]> {
  return coletarTudo<Subtipo>('/subtipos/')
}
