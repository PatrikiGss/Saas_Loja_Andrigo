import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessao } from '@/modules/auth/stores/sessao'
import * as servico from '@/modules/carrinho/services/carrinho'
import AdicionarAoCarrinho from './AdicionarAoCarrinho.vue'
import { falhaComResposta } from '../../../testes/falhas'
import { umCarrinho, umItemDeCarrinho, umProduto } from '../../../testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('@/modules/carrinho/services/carrinho')

const PRODUTO = umProduto()

const ROTAS = {
  produto: '/produto/:id',
  entrar: '/entrar',
  carrinho: '/carrinho',
}

async function montar(produto = PRODUTO) {
  const { tela: componente, router } = await montarNaRota(
    AdicionarAoCarrinho,
    `/produto/${produto.id}`,
    ROTAS,
    { props: { produto } },
  )
  return { componente, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.adicionarItem).mockReset()
  vi.mocked(servico.buscarCarrinho).mockReset()
  vi.mocked(servico.buscarCarrinho).mockResolvedValue(umCarrinho([]))
})

describe('AdicionarAoCarrinho', () => {
  it('manda para o login quem não entrou, guardando o caminho de volta', async () => {
    const { componente, router } = await montar()

    await componente.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('entrar')
    expect(router.currentRoute.value.query.destino).toBe(`/produto/${PRODUTO.id}`)
    // Nem chega a tentar: o endpoint exige conta, e a recusa seria certa.
    expect(servico.adicionarItem).not.toHaveBeenCalled()
  })

  it('adiciona com a quantidade escolhida quando há sessão', async () => {
    useSessao().token = 'token'
    vi.mocked(servico.adicionarItem).mockResolvedValue(
      umItemDeCarrinho({ quantidade: 3, produto: { id: PRODUTO.id } }),
    )
    const { componente } = await montar()

    await componente.get('input[type="number"]').setValue(3)
    await componente.get('button').trigger('click')
    await flushPromises()

    expect(servico.adicionarItem).toHaveBeenCalledWith(PRODUTO.id, 3)
    expect(componente.text()).toContain('Adicionado ao carrinho')
  })

  it('mostra a recusa do backend em vez de decidir por conta própria', async () => {
    useSessao().token = 'token'
    vi.mocked(servico.adicionarItem).mockRejectedValue(
      falhaComResposta(400, { quantidade: ['Quantidade acima do estoque disponível.'] }),
    )
    const { componente } = await montar()

    await componente.get('button').trigger('click')
    await flushPromises()

    expect(componente.text()).toContain('Quantidade acima do estoque disponível.')
    expect(componente.text()).not.toContain('Adicionado ao carrinho')
  })

  it('não oferece o botão para produto sem estoque', async () => {
    const { componente } = await montar({ ...PRODUTO, em_estoque: false })

    expect(componente.find('button').exists()).toBe(false)
    expect(componente.text()).toContain('sem estoque')
  })
})
