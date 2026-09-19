/**
 * Serviço do carrinho.
 *
 * Todas as rotas exigem conta autenticada, e o carrinho é sempre o de quem
 * pergunta: não existe id de carrinho na URL, então não há carrinho de outra
 * pessoa para pedir.
 */
import { objetoCom } from '@/services/conferencia'
import { http } from '@/services/http'
import type { Carrinho, ItemCarrinho } from '../types'

/** Mínimo de que a tela do carrinho depende para desenhar uma linha. */
const CAMPOS_DO_ITEM = ['id', 'produto', 'quantidade', 'subtotal'] as const

/** `GET /api/carrinho/` — criado no primeiro acesso, se ainda não existir. */
export async function buscarCarrinho(): Promise<Carrinho> {
  const { data } = await http.get<Carrinho>('/carrinho/')
  // `total` é dinheiro e vem do servidor; sem ele a tela mostraria vazio no
  // lugar do valor a pagar.
  return objetoCom<Carrinho>(data, ['itens', 'total'])
}

/**
 * `POST /api/carrinho/itens/`.
 *
 * Produto repetido soma à quantidade do item que já está lá; quem decide isso
 * é o backend. Estoque e disponibilidade também: produto sem estoque volta com
 * 400 e a mensagem do domínio.
 */
export async function adicionarItem(produto: string, quantidade: number): Promise<ItemCarrinho> {
  const { data } = await http.post<ItemCarrinho>('/carrinho/itens/', { produto, quantidade })
  return objetoCom<ItemCarrinho>(data, CAMPOS_DO_ITEM)
}

/**
 * `PATCH /api/carrinho/itens/<id>/` — a quantidade é o único campo do cliente.
 *
 * O item de outra conta não existe nesta consulta e responde 404, então não
 * há o que conferir aqui.
 */
export async function alterarQuantidade(item: number, quantidade: number): Promise<ItemCarrinho> {
  const { data } = await http.patch<ItemCarrinho>(`/carrinho/itens/${item}/`, { quantidade })
  return objetoCom<ItemCarrinho>(data, CAMPOS_DO_ITEM)
}

/** `DELETE /api/carrinho/itens/<id>/`. */
export async function removerItem(item: number): Promise<void> {
  await http.delete(`/carrinho/itens/${item}/`)
}

/** `DELETE /api/carrinho/itens/` — esvazia. O carrinho em si continua existindo. */
export async function esvaziar(): Promise<void> {
  await http.delete('/carrinho/itens/')
}
