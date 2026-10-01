import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as servico from '../services/carrinho'
import type { ItemCarrinho } from '../types'
import { useCarrinho } from './carrinho'
import { falhaComResposta } from '../../../testes/falhas'
import { umCarrinho, umItemDeCarrinho } from '../../../testes/fixtures'

vi.mock('../services/carrinho')

/** A R$ 10 cada, para os totais conferidos abaixo serem contas de cabeça. */
function item(id: number, quantidade: number, disponivel = true): ItemCarrinho {
  return umItemDeCarrinho({
    id,
    quantidade,
    produto: { id: `produto-${id}`, sku: `SKU-${id}`, preco: '10.00', disponivel },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.buscarCarrinho).mockReset()
  vi.mocked(servico.adicionarItem).mockReset()
  vi.mocked(servico.alterarQuantidade).mockReset()
  vi.mocked(servico.removerItem).mockReset()
  vi.mocked(servico.esvaziar).mockReset()
})

describe('carrinho', () => {
  it('carrega itens e total do servidor', async () => {
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([item(1, 2), item(2, 1)]))
    const carrinho = useCarrinho()

    await carrinho.carregar()

    expect(carrinho.itens).toHaveLength(2)
    expect(carrinho.total).toBe('30.00')
    expect(carrinho.quantidadeTotal).toBe(3)
  })

  it('só é vazio depois de ter carregado', async () => {
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([]))
    const carrinho = useCarrinho()

    // Antes de carregar, 'vazio' significaria 'ainda não sei'.
    expect(carrinho.vazio).toBe(false)

    await carrinho.carregar()

    expect(carrinho.vazio).toBe(true)
  })

  it('relê o carrinho depois de alterar, para o total vir do servidor', async () => {
    // O PATCH devolve o item, não o total; somar subtotais aqui seria o
    // frontend calculando dinheiro.
    vi.mocked(servico.alterarQuantidade).mockResolvedValue(item(1, 5))
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([item(1, 5)]))
    const carrinho = useCarrinho()

    await carrinho.alterarQuantidade(1, 5)

    expect(servico.buscarCarrinho).toHaveBeenCalledTimes(1)
    expect(carrinho.total).toBe('50.00')
  })

  it('devolve a recusa do backend sem lançar', async () => {
    vi.mocked(servico.alterarQuantidade).mockRejectedValue(
      falhaComResposta(400, { quantidade: ['Quantidade acima do estoque disponível.'] }),
    )
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([item(1, 2)]))
    const carrinho = useCarrinho()

    const falha = await carrinho.alterarQuantidade(1, 99)

    expect(falha?.campos.quantidade).toBe('Quantidade acima do estoque disponível.')
    // A quantidade na tela volta para a que o servidor guarda.
    expect(carrinho.itens[0].quantidade).toBe(2)
  })

  it('relê o carrinho mesmo quando a alteração é recusada', async () => {
    // O estoque pode ter mudado; o estado local não pode ficar defasado.
    vi.mocked(servico.removerItem).mockRejectedValue(
      falhaComResposta(400, { detail: ['Não deu.'] }),
    )
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([item(1, 1)]))
    const carrinho = useCarrinho()

    await carrinho.remover(1)

    expect(servico.buscarCarrinho).toHaveBeenCalledTimes(1)
    expect(carrinho.itens).toHaveLength(1)
  })

  it('esvazia pelo endereço da coleção, e não item a item', async () => {
    vi.mocked(servico.esvaziar).mockResolvedValue()
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([]))
    const carrinho = useCarrinho()

    await carrinho.limpar()

    expect(servico.esvaziar).toHaveBeenCalledTimes(1)
    expect(servico.removerItem).not.toHaveBeenCalled()
    expect(carrinho.vazio).toBe(true)
  })

  it('aponta item que o fechamento recusaria', async () => {
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([item(1, 1), item(2, 1, false)]))
    const carrinho = useCarrinho()

    await carrinho.carregar()

    expect(carrinho.temIndisponivel).toBe(true)
  })

  it('esquece tudo quando a sessão acaba', async () => {
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([item(1, 3)]))
    const carrinho = useCarrinho()
    await carrinho.carregar()

    carrinho.esquecer()

    // Senão o cabeçalho seguiria contando os itens de quem acabou de sair.
    expect(carrinho.quantidadeTotal).toBe(0)
    expect(carrinho.carregado).toBe(false)
  })

  it('guarda o erro quando nem a leitura inicial funciona', async () => {
    vi.mocked(servico.buscarCarrinho).mockRejectedValue(
      falhaComResposta(400, { detail: ['Falhou.'] }),
    )
    const carrinho = useCarrinho()

    await carrinho.carregar()

    expect(carrinho.erro).not.toBeNull()
    expect(carrinho.carregado).toBe(false)
  })
})
