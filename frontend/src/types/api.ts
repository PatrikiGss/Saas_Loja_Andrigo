/** Formas de resposta que a API repete em vários recursos. */

/** Página do `PageNumberPagination` do DRF. O backend usa 20 por página. */
export interface Paginado<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
