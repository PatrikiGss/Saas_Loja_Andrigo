/**
 * Cor de cada categoria e agrupamento dos subtipos.
 *
 * A cor é decisão de apresentação e por isso vive aqui: o backend não tem, e
 * não deve ter, coluna de cor. O nome legível, ao contrário, é do backend —
 * vem em `categoria_display` e não é reescrito neste arquivo.
 */
import type { Categoria, CategoriaSlug, Subtipo } from './types'

const COR_POR_CATEGORIA: Record<CategoriaSlug, string> = {
  pod_descartavel: 'var(--cat-pod-descartavel)',
  pod_recarregavel: 'var(--cat-pod-recarregavel)',
  vape: 'var(--cat-vape)',
  essencia: 'var(--cat-essencia)',
  vaporizador_ervas: 'var(--cat-vaporizador-ervas)',
}

/**
 * Matiz da categoria.
 *
 * Categoria desconhecida devolve o cinza neutro em vez de quebrar: o backend
 * pode ganhar uma categoria nova antes deste arquivo saber dela.
 */
export function corDaCategoria(slug: string): string {
  return COR_POR_CATEGORIA[slug as CategoriaSlug] ?? 'var(--cat-indefinida)'
}

/**
 * Agrupa os subtipos pela categoria, preservando a ordem que a API mandou.
 *
 * O backend ordena por categoria e nome, então a ordem já chega estável e não
 * precisa ser reinventada aqui.
 */
export function agruparPorCategoria(subtipos: Subtipo[]): Categoria[] {
  const categorias = new Map<CategoriaSlug, Categoria>()

  for (const subtipo of subtipos) {
    const existente = categorias.get(subtipo.categoria)
    if (existente) {
      existente.subtipos.push(subtipo)
    } else {
      categorias.set(subtipo.categoria, {
        slug: subtipo.categoria,
        nome: subtipo.categoria_display,
        subtipos: [subtipo],
      })
    }
  }

  return [...categorias.values()]
}
