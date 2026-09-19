/** Formas que a app `carrinho` do backend devolve. */

/** Produto como o carrinho o mostra: o suficiente para a linha do item. */
export interface ProdutoNoCarrinho {
  id: string
  sku: string
  nome: string
  preco: string
  /** Resume ativo + em estoque, sem expor a quantidade em estoque. */
  disponivel: boolean
}

/** Linha do carrinho. `subtotal` vem calculado pelo servidor. */
export interface ItemCarrinho {
  id: number
  produto: ProdutoNoCarrinho
  quantidade: number
  subtotal: string
}

/**
 * Resposta de `GET /api/carrinho/`.
 *
 * O `total` vem calculado pelo servidor e é o único valor oficial: o frontend
 * nunca soma subtotais para chegar nele.
 */
export interface Carrinho {
  itens: ItemCarrinho[]
  total: string
}

/** Teto por item no backend (`QUANTIDADE_MAXIMA`). */
export const QUANTIDADE_MAXIMA = 100
