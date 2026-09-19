import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AjusteDeEstoque from './AjusteDeEstoque.vue'
import * as servico from '../services/produtos'

vi.mock('../services/produtos')

function montar(estoque = 10) {
  return mount(AjusteDeEstoque, { props: { id: 'produto-1', estoque } })
}

function botao(tela: ReturnType<typeof montar>, texto: string) {
  return tela.findAll('button').find((item) => item.text().includes(texto))!
}

beforeEach(() => {
  vi.mocked(servico.ajustarEstoque).mockReset().mockResolvedValue(15)
})

describe('AjusteDeEstoque', () => {
  it('repõe com delta positivo', async () => {
    const tela = montar()

    await tela.get('input').setValue(5)
    await botao(tela, 'Repor').trigger('click')
    await flushPromises()

    expect(servico.ajustarEstoque).toHaveBeenCalledWith('produto-1', 5)
  })

  it('dá baixa com delta negativo, sem pedir o sinal a quem usa', async () => {
    // Digitar um menos à mão é convite a erro caro num ajuste de estoque.
    const tela = montar()

    await tela.get('input').setValue(3)
    await botao(tela, 'Dar baixa').trigger('click')
    await flushPromises()

    expect(servico.ajustarEstoque).toHaveBeenCalledWith('produto-1', -3)
  })

  it('devolve o estoque que o banco calculou', async () => {
    const tela = montar()

    await botao(tela, 'Repor').trigger('click')
    await flushPromises()

    expect(tela.emitted('ajustado')).toEqual([[15]])
  })

  it('não manda ajuste de zero, que o backend recusaria', async () => {
    const tela = montar()

    await tela.get('input').setValue(0)
    await botao(tela, 'Repor').trigger('click')
    await flushPromises()

    expect(servico.ajustarEstoque).not.toHaveBeenCalled()
  })

  it('mostra a recusa da baixa maior que o disponível', async () => {
    const config = { headers: new AxiosHeaders() }
    vi.mocked(servico.ajustarEstoque).mockRejectedValue(
      new AxiosError('falhou', '400', config, {}, {
        status: 400,
        data: { delta: ['Estoque insuficiente para a baixa solicitada.'] },
        statusText: '',
        headers: {},
        config,
      } as AxiosResponse),
    )
    const tela = montar()

    await botao(tela, 'Dar baixa').trigger('click')
    await flushPromises()

    expect(tela.text()).toContain('Estoque insuficiente')
  })

  it('não dispara dois ajustes ao mesmo tempo', async () => {
    let liberar!: (estoque: number) => void
    vi.mocked(servico.ajustarEstoque).mockReturnValue(
      new Promise((resolver) => (liberar = resolver)),
    )
    const tela = montar()

    await botao(tela, 'Repor').trigger('click')
    await botao(tela, 'Dar baixa').trigger('click')

    expect(servico.ajustarEstoque).toHaveBeenCalledTimes(1)

    liberar(11)
    await flushPromises()
  })
})
