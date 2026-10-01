import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

import { instalarVerificacaoDeIdade } from './instalar'
import { sairDoSite } from './sair'
import { useIdade } from './stores/idade'
import { roteadorDeTeste } from '../../testes/roteador'

vi.mock('./sair')

async function preparar(): Promise<Router> {
  const router = roteadorDeTeste({
    inicio: '/',
    catalogo: '/catalogo',
    carrinho: { caminho: '/carrinho', meta: { confirmaIdade: true } },
  })
  instalarVerificacaoDeIdade(router)
  await router.push('/')
  return router
}

/** Responde a pergunta da entrada, que abre na partida. */
async function passarDaEntrada(): Promise<void> {
  useIdade().responder(true)
  await flushPromises()
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(sairDoSite).mockReset()
  setActivePinia(createPinia())
})

describe('instalarVerificacaoDeIdade', () => {
  it('pergunta a quem acabou de chegar', async () => {
    await preparar()

    expect(useIdade().pergunta).toBe('entrada')
  })

  it('segura a ida ao carrinho até o sim', async () => {
    const router = await preparar()
    await passarDaEntrada()

    const navegacao = router.push('/carrinho')
    await flushPromises()
    expect(useIdade().pergunta).toBe('compra')
    expect(router.currentRoute.value.path).toBe('/')

    useIdade().responder(true)
    await navegacao

    expect(router.currentRoute.value.path).toBe('/carrinho')
  })

  it('com não, a navegação não acontece e a pessoa sai do site', async () => {
    const router = await preparar()
    await passarDaEntrada()

    const navegacao = router.push('/carrinho')
    await flushPromises()
    useIdade().responder(false)
    await navegacao

    expect(sairDoSite).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('rota sem marcação não pergunta nada', async () => {
    const router = await preparar()
    await passarDaEntrada()

    await router.push('/catalogo')

    expect(useIdade().pergunta).toBeNull()
    expect(router.currentRoute.value.path).toBe('/catalogo')
  })
})
