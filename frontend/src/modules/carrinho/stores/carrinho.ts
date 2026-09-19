/**
 * Carrinho da conta autenticada.
 *
 * É estado global porque aparece em dois lugares que não se conhecem: a
 * contagem no cabeçalho e a página do carrinho.
 *
 * Depois de qualquer alteração, o carrinho inteiro é relido. Parece
 * desperdício, mas `total` só existe em `GET /api/carrinho/` — o PATCH devolve
 * o item, não o total — e somar subtotais aqui seria o frontend calculando
 * dinheiro. A releitura também pega mudança de preço e de estoque que tenha
 * acontecido enquanto a página estava aberta, já que o carrinho lê o produto
 * ao vivo.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { deErro, type ErroDaApi } from '@/services/erros'
import * as servico from '../services/carrinho'
import type { ItemCarrinho } from '../types'

export const useCarrinho = defineStore('carrinho', () => {
  const itens = ref<ItemCarrinho[]>([])
  const total = ref('0')
  const carregando = ref(false)
  const salvando = ref(false)
  const erro = ref<ErroDaApi | null>(null)
  const carregado = ref(false)

  /** Soma das quantidades, para a contagem do cabeçalho. */
  const quantidadeTotal = computed(() =>
    itens.value.reduce((soma, item) => soma + item.quantidade, 0),
  )

  const vazio = computed(() => carregado.value && itens.value.length === 0)

  /** Itens que o backend já não aceitaria no fechamento. */
  const temIndisponivel = computed(() => itens.value.some((item) => !item.produto.disponivel))

  function esquecer(): void {
    itens.value = []
    total.value = '0'
    erro.value = null
    carregado.value = false
  }

  function guardar(carrinho: { itens: ItemCarrinho[]; total: string }): void {
    itens.value = carrinho.itens
    total.value = carrinho.total
    carregado.value = true
  }

  async function carregar(): Promise<void> {
    carregando.value = true
    erro.value = null
    try {
      guardar(await servico.buscarCarrinho())
    } catch (falha) {
      erro.value = deErro(falha)
    } finally {
      carregando.value = false
    }
  }

  /**
   * Roda uma alteração e relê o carrinho.
   *
   * Devolve o erro em vez de lançar: quem chamou é uma tela, e tela trata
   * erro mostrando, não quebrando.
   */
  async function alterar(operacao: () => Promise<unknown>): Promise<ErroDaApi | null> {
    salvando.value = true
    erro.value = null
    try {
      await operacao()
      guardar(await servico.buscarCarrinho())
      return null
    } catch (falha) {
      const problema = deErro(falha)
      erro.value = problema

      // O estado local pode estar defasado depois de uma recusa — o estoque
      // pode ter mudado. A releitura é secundária: se ela também falhar, o
      // erro que interessa é o da operação, que já está guardado.
      try {
        guardar(await servico.buscarCarrinho())
      } catch {
        // Sem tratamento: o erro da operação é o que a tela precisa mostrar.
      }

      return problema
    } finally {
      salvando.value = false
    }
  }

  function adicionar(produto: string, quantidade: number): Promise<ErroDaApi | null> {
    return alterar(() => servico.adicionarItem(produto, quantidade))
  }

  function alterarQuantidade(item: number, quantidade: number): Promise<ErroDaApi | null> {
    return alterar(() => servico.alterarQuantidade(item, quantidade))
  }

  function remover(item: number): Promise<ErroDaApi | null> {
    return alterar(() => servico.removerItem(item))
  }

  function limpar(): Promise<ErroDaApi | null> {
    return alterar(() => servico.esvaziar())
  }

  return {
    itens,
    total,
    carregando,
    salvando,
    erro,
    carregado,
    quantidadeTotal,
    vazio,
    temIndisponivel,
    carregar,
    adicionar,
    alterarQuantidade,
    remover,
    limpar,
    esquecer,
  }
})
