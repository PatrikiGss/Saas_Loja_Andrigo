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

/**
 * Resposta de `GET /api/produtos/` e `GET /api/produtos/<id>/`.
 *
 * Os campos decimais chegam como texto: o DRF serializa `DecimalField` assim
 * para não perder precisão no caminho. Eles são para mostrar, não para
 * calcular — qualquer conta de dinheiro é do servidor.
 *
 * `em_estoque` é booleano de propósito: a quantidade em estoque não é pública
 * no catálogo, e a API não a expõe aqui.
 */
export interface Produto {
  id: string
  sku: string
  nome: string
  descricao: string
  marca: string
  categoria: CategoriaSlug
  /** Slug do subtipo. */
  subtipo: string
  preco: string
  em_estoque: boolean
  /** Especificações. Vêm nulas nas categorias em que não se aplicam. */
  puffs: number | null
  volume_ml: string | null
  nicotina_mg_ml: string | null
}

/** Ordenações aceitas: são os `ordering_fields` do `ProdutoViewSet`. */
export type Ordenacao = 'nome' | '-nome' | 'preco' | '-preco' | '-criado_em'

export const ORDENACOES: ReadonlyArray<{ valor: Ordenacao; texto: string }> = [
  { valor: 'nome', texto: 'Nome (A–Z)' },
  { valor: '-nome', texto: 'Nome (Z–A)' },
  { valor: 'preco', texto: 'Menor preço' },
  { valor: '-preco', texto: 'Maior preço' },
  { valor: '-criado_em', texto: 'Novidades' },
]

/** Filtros que o backend realmente suporta. Nada além destes existe na API. */
export interface FiltrosDoCatalogo {
  categoria?: string
  subtipo?: string
  busca?: string
  ordem?: Ordenacao
  pagina?: number
}
