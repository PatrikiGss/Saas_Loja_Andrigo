import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as servicoCarrinho from '@/modules/carrinho/services/carrinho'
import * as servicoEnderecos from '@/modules/enderecos/services/enderecos'
import type { Pedido } from '@/modules/pedidos/types'
import ResumoDoPedido from '../components/ResumoDoPedido.vue'
import CheckoutView from './CheckoutView.vue'
import * as servicoCheckout from '../services/checkout'
import { falhaComResposta } from '@/testes/falhas'
import { umCarrinho, umEndereco, umItemDeCarrinho, umPedido } from '@/testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('@/modules/carrinho/services/carrinho')
vi.mock('@/modules/enderecos/services/enderecos')
vi.mock('../services/checkout')

const ENDERECO = umEndereco()

const PEDIDO = umPedido()

const ROTAS = {
  checkout: '/checkout',
  catalogo: '/catalogo',
  carrinho: '/carrinho',
  pedido: '/pedidos/:numero',
}

async function montar() {
  return (await montarNaRota(CheckoutView, '/checkout', ROTAS)).tela
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servicoCarrinho.buscarCarrinho).mockReset().mockResolvedValue(umCarrinho())
  vi.mocked(servicoEnderecos.listarEnderecos).mockReset().mockResolvedValue([ENDERECO])
  vi.mocked(servicoCheckout.cotarFrete)
    .mockReset()
    .mockResolvedValue([
      { servico: 'economico', nome: 'Econômico', preco: '19.90', prazo_em_dias: 4 },
    ])
  vi.mocked(servicoCheckout.fecharPedido).mockReset().mockResolvedValue(PEDIDO)
})

/** Clica no botão cujo texto contém o rótulo. */
async function clicar(tela: Awaited<ReturnType<typeof montar>>, texto: string) {
  const botao = tela.findAll('button').find((item) => item.text().includes(texto))
  await botao!.trigger('click')
  await flushPromises()
}

/**
 * Anda do endereço até o resumo.
 *
 * O frete é escolhido pelo rádio, e não por um botão: cada opção é um
 * `<label>` inteiro clicável.
 */
async function avancarAteOResumo(tela: Awaited<ReturnType<typeof montar>>) {
  await clicar(tela, 'Continuar')
  await tela.get('input[type="radio"][value="economico"]').setValue()
  await flushPromises()
  await clicar(tela, 'Continuar')
}

describe('CheckoutView', () => {
  it('fecha o pedido uma vez só, mesmo com dois cliques seguidos', async () => {
    // O botão se desabilita, mas isso é interface. Dois pedidos iguais não se
    // desfazem recarregando a página.
    let liberar!: (pedido: Pedido) => void
    vi.mocked(servicoCheckout.fecharPedido).mockReturnValue(
      new Promise((resolver) => (liberar = resolver)),
    )

    const tela = await montar()
    await avancarAteOResumo(tela)

    // Direto pelo evento, e não pelo botão: depois do primeiro clique o botão
    // se desabilita e o teste passaria sem nunca chegar à trava do `fechar()`.
    // É o caminho de um atalho de teclado ou de um clique duplo que chega
    // antes de a tela redesenhar.
    const resumo = tela.findComponent(ResumoDoPedido)
    resumo.vm.$emit('fechar')
    resumo.vm.$emit('fechar')
    resumo.vm.$emit('fechar')

    expect(servicoCheckout.fecharPedido).toHaveBeenCalledTimes(1)

    liberar(PEDIDO)
    await flushPromises()
  })

  it('não fecha de novo depois que o pedido já existe', async () => {
    const tela = await montar()
    await avancarAteOResumo(tela)
    await clicar(tela, 'Fechar pedido')

    expect(tela.text()).toContain('Pedido registrado')
    expect(servicoCheckout.fecharPedido).toHaveBeenCalledTimes(1)
  })

  it('manda só endereço e serviço: os valores são recalculados no servidor', async () => {
    const tela = await montar()
    await avancarAteOResumo(tela)
    await clicar(tela, 'Fechar pedido')

    expect(servicoCheckout.fecharPedido).toHaveBeenCalledWith(ENDERECO.id, 'economico')
  })

  it('recarrega o carrinho depois de fechar, que o backend esvaziou', async () => {
    const tela = await montar()
    const antes = vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length

    await avancarAteOResumo(tela)
    await clicar(tela, 'Fechar pedido')

    expect(vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length).toBeGreaterThan(antes)
  })

  it('barra o fechamento quando o carrinho está vazio', async () => {
    vi.mocked(servicoCarrinho.buscarCarrinho).mockResolvedValue(umCarrinho([]))

    const tela = await montar()

    expect(tela.text()).toContain('Não há o que fechar')
  })

  it('mostra a recusa do fechamento e relê o carrinho', async () => {
    vi.mocked(servicoCheckout.fecharPedido).mockRejectedValue(
      falhaComResposta(400, { pedido: ['Há pedidos demais aguardando pagamento nesta conta.'] }),
    )

    const tela = await montar()
    await avancarAteOResumo(tela)
    const leiturasAntes = vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length

    await clicar(tela, 'Fechar pedido')

    expect(tela.text()).toContain('Há pedidos demais aguardando pagamento')
    // A recusa pode vir de estoque ou de produto retirado de venda.
    expect(vi.mocked(servicoCarrinho.buscarCarrinho).mock.calls.length).toBeGreaterThan(
      leiturasAntes,
    )
  })

  it('deixa voltar a um passo já cumprido', async () => {
    const tela = await montar()
    await avancarAteOResumo(tela)
    expect(tela.text()).toContain('Confira antes de fechar')

    await clicar(tela, 'Endereço')

    expect(tela.text()).toContain('Para onde entregamos?')
  })

  it('cota o frete de novo ao repetir depois de uma falha', async () => {
    const { ErroDaApi } = await import('@/services/erros')
    vi.mocked(servicoCheckout.cotarFrete).mockRejectedValueOnce(
      new ErroDaApi('rede', 'Sem resposta da loja.', null, {}),
    )

    const tela = await montar()
    await clicar(tela, 'Continuar')
    expect(tela.text()).toContain('Sem resposta da loja')

    await clicar(tela, 'Tentar de novo')

    expect(tela.text()).toContain('Econômico')
  })

  it('barra o fechamento quando há produto indisponível', async () => {
    vi.mocked(servicoCarrinho.buscarCarrinho).mockResolvedValue(
      umCarrinho([umItemDeCarrinho({ produto: { disponivel: false } })]),
    )

    const tela = await montar()

    expect(tela.text()).toContain('indisponível')
  })
})
