import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CarrinhoView from './CarrinhoView.vue'
import * as servico from '../services/carrinho'
import { useCarrinho } from '../stores/carrinho'
import type { ItemCarrinho } from '../types'
import { falhaComResposta } from '../../../testes/falhas'
import { umCarrinho, umItemDeCarrinho } from '../../../testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('../services/carrinho')

function item(id: number, nome: string, disponivel = true): ItemCarrinho {
  return umItemDeCarrinho({ id, produto: { id: `p${id}`, nome, disponivel } })
}

const ROTAS = {
  carrinho: '/carrinho',
  catalogo: '/catalogo',
  checkout: '/checkout',
}

/**
 * Quem enche a store é o `instalarCarrinho`, quando a sessão começa; a tela
 * só a lê. Aqui o teste faz esse papel com a tela já aberta, que passa pelo
 * estado de carregamento como passaria no navegador.
 */
async function montar() {
  const montada = await montarNaRota(CarrinhoView, '/carrinho', ROTAS)
  await useCarrinho().carregar()
  await flushPromises()
  return montada
}

async function clicar(tela: Awaited<ReturnType<typeof montar>>['tela'], texto: string) {
  await tela
    .findAll('button')
    .find((b) => b.text().includes(texto))!
    .trigger('click')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.buscarCarrinho)
    .mockReset()
    .mockResolvedValue(umCarrinho([item(1, 'Pod de menta')]))
  vi.mocked(servico.alterarQuantidade).mockReset().mockResolvedValue(item(1, 'Pod de menta'))
  vi.mocked(servico.removerItem).mockReset().mockResolvedValue()
  vi.mocked(servico.esvaziar).mockReset().mockResolvedValue()
})

describe('CarrinhoView', () => {
  it('lista os itens com o total do servidor', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Pod de menta')
    expect(tela.text()).toContain('99,80')
  })

  it('convida ao catálogo quando está vazio', async () => {
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([]))

    const { tela } = await montar()

    expect(tela.text()).toContain('Seu carrinho está vazio')
    expect(tela.findAll('a').map((a) => a.attributes('href'))).toContain('/catalogo')
  })

  it('leva ao fechamento do pedido', async () => {
    const { tela, router } = await montar()

    await clicar(tela, 'Fechar pedido')

    expect(router.currentRoute.value.path).toBe('/checkout')
  })

  it('barra o fechamento quando há item indisponível', async () => {
    // O backend recusaria o checkout; avisar aqui evita a viagem perdida.
    vi.mocked(servico.buscarCarrinho).mockResolvedValue(
      umCarrinho([item(1, 'Pod aposentado', false)]),
    )

    const { tela } = await montar()
    const fechar = tela.findAll('button').find((b) => b.text().includes('Fechar pedido'))!

    expect(fechar.attributes('disabled')).toBeDefined()
    expect(tela.text()).toContain('Retire o item indisponível')
  })

  it('pede confirmação antes de limpar, e só então chama a API', async () => {
    const { tela } = await montar()

    await clicar(tela, 'Limpar carrinho')
    expect(servico.esvaziar).not.toHaveBeenCalled()
    expect(tela.text()).toContain('Não dá para desfazer')

    // O botão de confirmar é o de dentro do diálogo: o da página tem o mesmo
    // texto e só reabriria a caixa.
    const confirmar = tela
      .get('dialog')
      .findAll('button')
      .find((b) => b.text().includes('Limpar carrinho'))!
    await confirmar.trigger('click')
    await flushPromises()

    expect(servico.esvaziar).toHaveBeenCalledTimes(1)
  })

  it('remove um item pelo id', async () => {
    const { tela } = await montar()

    await clicar(tela, 'Remover')

    expect(servico.removerItem).toHaveBeenCalledWith(1)
  })

  it('mantém a lista na tela quando uma alteração é recusada', async () => {
    vi.mocked(servico.removerItem).mockRejectedValue(falhaComResposta(400, { detail: 'Não deu.' }))

    const { tela } = await montar()
    await clicar(tela, 'Remover')

    expect(tela.text()).toContain('Não deu.')
    // O carrinho continua visível: a pessoa vê o que foi recusado.
    expect(tela.text()).toContain('Pod de menta')
  })

  it('diz que o frete vem depois, porque depende do destino', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('frete depende do destino')
  })
})
