import { beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/services/http'
import { buscarPedido, listarPedidos } from './pedidos'

vi.mock('@/services/http', () => ({
  http: { get: vi.fn() },
}))

const get = vi.mocked(http.get)

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } } as never)
})

describe('listarPedidos', () => {
  it('não manda a primeira página, que já é o padrão da API', async () => {
    await listarPedidos(1)

    expect(get).toHaveBeenCalledWith('/pedidos/', { params: {} })
  })

  it('pede a página quando não é a primeira', async () => {
    await listarPedidos(3)

    expect(get).toHaveBeenCalledWith('/pedidos/', { params: { page: '3' } })
  })
})

describe('buscarPedido', () => {
  it('usa o número como chave, e não um id', async () => {
    // O `lookup_field` do ViewSet é `numero`; o id do pedido é UUID e não
    // aparece na API.
    await buscarPedido('PED-20260919-4DDA1D')

    expect(get).toHaveBeenCalledWith('/pedidos/PED-20260919-4DDA1D/')
  })
})
