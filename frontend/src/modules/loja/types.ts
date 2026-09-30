/** Formas que a app `loja` do backend devolve, geradas do esquema. */
import type { Consulta, Esquema } from '@/types/api'

/** Valores de `Categoria.choices`. O rótulo legível vem da API, não daqui. */
export type CategoriaSlug = Esquema<'CategoriaEnum'>

/** Resposta de `GET /api/subtipos/`. */
export type Subtipo = Esquema<'Subtipo'>

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
 * no catálogo, e a API não a expõe aqui. As especificações vêm nulas nas
 * categorias em que não se aplicam.
 */
export type Produto = Esquema<'Produto'>

/** Ordenações que o `ProdutoViewSet` aceita. */
export type Ordenacao = NonNullable<Consulta<'/api/produtos/'>['ordering']>

/** As que a vitrine oferece, e com que nome. */
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
