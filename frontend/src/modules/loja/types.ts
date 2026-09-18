/** Formas que a app `loja` do backend devolve. */

/** Valores de `Categoria.choices`. O rótulo legível vem da API, não daqui. */
export type CategoriaSlug =
  | 'pod_descartavel'
  | 'pod_recarregavel'
  | 'vape'
  | 'essencia'
  | 'vaporizador_ervas'

/** Resposta de `GET /api/subtipos/`. */
export interface Subtipo {
  slug: string
  nome: string
  categoria: CategoriaSlug
  categoria_display: string
}

/** Uma categoria montada a partir dos subtipos que a API devolveu. */
export interface Categoria {
  slug: CategoriaSlug
  nome: string
  subtipos: Subtipo[]
}
