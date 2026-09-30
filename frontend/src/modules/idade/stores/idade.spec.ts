import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sairDoSite } from '../sair'
import { useIdade } from './idade'

vi.mock('../sair')

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(sairDoSite).mockReset()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useIdade', () => {
  it('não pergunta nada antes de alguém pedir', () => {
    expect(useIdade().pergunta).toBeNull()
  })

  it('pergunta na entrada e libera com sim', async () => {
    const idade = useIdade()

    const resposta = idade.confirmar('entrada')
    expect(idade.pergunta).toBe('entrada')
    idade.responder(true)

    await expect(resposta).resolves.toBe(true)
    expect(idade.pergunta).toBeNull()
  })

  it('lembra do sim pela sessão do navegador', async () => {
    const antes = useIdade()
    const resposta = antes.confirmar('entrada')
    antes.responder(true)
    await resposta

    // Página recarregada: estado novo, mesma sessão.
    setActivePinia(createPinia())
    const depois = useIdade()

    await expect(depois.confirmar('entrada')).resolves.toBe(true)
    expect(depois.pergunta).toBeNull()
  })

  it('o sim da entrada não vale para o carrinho', async () => {
    const idade = useIdade()
    const entrada = idade.confirmar('entrada')
    idade.responder(true)
    await entrada

    void idade.confirmar('compra')

    expect(idade.pergunta).toBe('compra')
  })

  it('com não, tira a pessoa do site e não guarda nada', async () => {
    const idade = useIdade()

    const resposta = idade.confirmar('compra')
    idade.responder(false)

    expect(sairDoSite).toHaveBeenCalledOnce()
    await expect(resposta).resolves.toBe(false)
    expect(sessionStorage.length).toBe(0)
  })

  it('com as duas pendentes, pergunta uma vez só e o sim vale para as duas', async () => {
    // Quem abre o carrinho direto como primeira página.
    const idade = useIdade()
    const entrada = idade.confirmar('entrada')
    const compra = idade.confirmar('compra')

    expect(idade.pergunta).toBe('compra')
    idade.responder(true)

    await expect(entrada).resolves.toBe(true)
    await expect(compra).resolves.toBe(true)
    expect(idade.pergunta).toBeNull()
  })

  it('com o armazenamento bloqueado, o sim vale até recarregar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    const idade = useIdade()

    const resposta = idade.confirmar('entrada')
    idade.responder(true)

    await expect(resposta).resolves.toBe(true)
    await expect(idade.confirmar('entrada')).resolves.toBe(true)
    expect(idade.pergunta).toBeNull()
  })

  it('resposta sem pergunta aberta não faz nada', () => {
    useIdade().responder(false)

    expect(sairDoSite).not.toHaveBeenCalled()
  })
})
