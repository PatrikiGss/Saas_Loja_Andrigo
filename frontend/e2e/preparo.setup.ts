/**
 * Cadastra pela API de gestão o produto que os testes compram.
 *
 * Roda uma vez, antes de todos. O banco dos testes nasce com os subtipos das
 * migrations e a conta admin da fixture; o resto sai daqui.
 */
import { test as preparo } from '@playwright/test'

import type { Esquema } from '../src/types/api'
import { API, PRODUTO, expect, tokenDoAdmin } from './apoio'

preparo('cadastra o produto e põe estoque', async ({ request }) => {
  const cabecalhos = { Authorization: `Bearer ${await tokenDoAdmin(request)}` }

  const subtipos = (await (
    await request.get(`${API}/subtipos/`)
  ).json()) as Esquema<'PaginatedSubtipoList'>
  const vape = subtipos.results.find((subtipo) => subtipo.categoria === 'vape')
  expect(vape, 'subtipo de vape vindo da migration').toBeDefined()

  const cadastro = await request.post(`${API}/produtos/`, {
    headers: cabecalhos,
    data: { ...PRODUTO, subtipo: vape!.slug } satisfies Esquema<'ProdutoGestaoRequest'>,
  })
  expect(cadastro.status(), await cadastro.text()).toBe(201)
  const { id } = (await cadastro.json()) as Esquema<'ProdutoGestao'>

  const estoque = await request.post(`${API}/produtos/${id}/estoque/`, {
    headers: cabecalhos,
    data: { delta: 50 } satisfies Esquema<'AjusteEstoqueRequest'>,
  })
  expect(estoque.ok(), await estoque.text()).toBe(true)
})
