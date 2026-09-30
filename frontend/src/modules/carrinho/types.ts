/** Formas que a app `carrinho` do backend devolve, geradas do esquema. */
import type { Esquema } from '@/types/api'

/**
 * Produto como o carrinho o mostra. `disponivel` resume ativo + em estoque,
 * sem expor a quantidade em estoque.
 */
export type ProdutoNoCarrinho = Esquema<'ProdutoNoCarrinho'>

/** Linha do carrinho. `subtotal` vem calculado pelo servidor. */
export type ItemCarrinho = Esquema<'ItemCarrinho'>

/**
 * Resposta de `GET /api/carrinho/`.
 *
 * O `total` vem calculado pelo servidor e é o único valor oficial: o frontend
 * nunca soma subtotais para chegar nele.
 */
export type Carrinho = Esquema<'Carrinho'>

/**
 * Teto por item no backend (`QUANTIDADE_MAXIMA`).
 *
 * O esquema traz o teto como `maximum` do campo, mas limite numérico não vira
 * tipo, então ele continua escrito aqui. Serve só para o seletor não oferecer
 * o que o servidor recusaria: quem valida é o backend.
 */
export const QUANTIDADE_MAXIMA = 100
