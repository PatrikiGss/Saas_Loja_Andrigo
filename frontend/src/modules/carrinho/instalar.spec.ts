import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useSessao } from '@/modules/auth/stores/sessao'
import { instalarCarrinho } from './instalar'
import * as servico from './services/carrinho'
import { useCarrinho } from './stores/carrinho'
import { umCarrinho, umItemDeCarrinho } from '../../testes/fixtures'

vi.mock('./services/carrinho')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.buscarCarrinho)
    .mockReset()
    .mockResolvedValue(umCarrinho([umItemDeCarrinho({ quantidade: 2 })]))
})

describe('instalarCarrinho', () => {
  it('não busca carrinho de quem não entrou', async () => {
    instalarCarrinho()
    await nextTick()

    // Na partida a sessão ainda não foi restaurada pelo cookie.
    expect(servico.buscarCarrinho).not.toHaveBeenCalled()
  })

  it('carrega assim que a sessão é restaurada', async () => {
    const sessao = useSessao()
    instalarCarrinho()

    sessao.token = 'token'
    await nextTick()
    await vi.waitFor(() => expect(servico.buscarCarrinho).toHaveBeenCalledTimes(1))

    expect(useCarrinho().quantidadeTotal).toBe(2)
  })

  it('esquece o carrinho quando alguém sai', async () => {
    // Senão o cabeçalho seguiria contando os itens de quem deixou o navegador.
    const sessao = useSessao()
    instalarCarrinho()

    sessao.token = 'token'
    await nextTick()
    await vi.waitFor(() => expect(useCarrinho().quantidadeTotal).toBe(2))

    sessao.token = null
    await nextTick()

    expect(useCarrinho().quantidadeTotal).toBe(0)
    expect(useCarrinho().carregado).toBe(false)
  })
})
