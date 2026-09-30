/**
 * O que os testes ponta a ponta compartilham.
 *
 * As chamadas diretas à API aqui são preparo, não o que se testa: criar e
 * ativar a conta de cada teste, e cadastrar o produto. O que se testa passa
 * pela tela, como uma pessoa faria.
 */
import { randomUUID } from 'node:crypto'

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

import type { Esquema } from '../src/types/api'

export const API = 'http://localhost:8000/api'

/** Conta de `backend/configs/fixture_e2e.json`. Só existe no banco dos testes. */
export const ADMIN: Conta = { email: 'admin@loja.test', senha: 'admin-da-suite-e2e', nome: 'Admin' }

/** O produto que o preparo cadastra. Um vape, que não exige especificação. */
export const PRODUTO = {
  sku: 'E2E-VAPE-001',
  nome: 'Kit ponta a ponta',
  marca: 'Marca E2E',
  preco: '149.90',
}

export interface Conta {
  email: string
  senha: string
  nome: string
}

async function token(api: APIRequestContext, conta: Conta): Promise<string> {
  const resposta = await api.post(`${API}/auth/login/`, {
    data: { email: conta.email, password: conta.senha } satisfies Esquema<'LoginRequest'>,
  })
  expect(resposta.ok(), `login de ${conta.email}`).toBe(true)
  return ((await resposta.json()) as Esquema<'Acesso'>).access
}

export function tokenDoAdmin(api: APIRequestContext): Promise<string> {
  return token(api, ADMIN)
}

/**
 * Um pedido da conta, esperando pagamento, fechado pela API.
 *
 * Para os testes em que o pedido é o ponto de partida, e não o que se testa:
 * o caminho pela tela já tem teste próprio em `compra.spec.ts`.
 */
export async function pedidoAguardandoPagamento(
  api: APIRequestContext,
  conta: Conta,
): Promise<string> {
  const cabecalhos = { Authorization: `Bearer ${await token(api, conta)}` }

  const catalogo = (await (
    await api.get(`${API}/produtos/`, { params: { search: PRODUTO.sku } })
  ).json()) as Esquema<'PaginatedProdutoConformeQuemPerguntaList'>
  const produto = catalogo.results[0]
  expect(produto, 'produto do preparo no catálogo').toBeDefined()

  const item = await api.post(`${API}/carrinho/itens/`, {
    headers: cabecalhos,
    data: { produto: produto.id, quantidade: 1 } satisfies Esquema<'AdicionarItemRequest'>,
  })
  expect(item.status(), await item.text()).toBe(201)

  const endereco = await api.post(`${API}/enderecos/`, {
    headers: cabecalhos,
    data: {
      cep: '01001000',
      logradouro: 'Praça da Sé',
      numero: '100',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    } satisfies Esquema<'EnderecoRequest'>,
  })
  expect(endereco.status(), await endereco.text()).toBe(201)
  const { id } = (await endereco.json()) as Esquema<'Endereco'>

  const checkout = await api.post(`${API}/checkout/`, {
    headers: cabecalhos,
    data: { endereco: id, servico: 'economico' } satisfies Esquema<'CheckoutRequest'>,
  })
  expect(checkout.status(), await checkout.text()).toBe(201)
  return ((await checkout.json()) as Esquema<'Pedido'>).numero
}

/**
 * Cada teste ganha uma conta de cliente nova, com carrinho vazio e sem
 * endereço: nenhum depende do que outro deixou para trás.
 */
export const test = base.extend<{ cliente: Conta; idadeRespondida: boolean }>({
  /**
   * A pergunta de idade tem teste próprio (`idade.spec.ts`, que desliga
   * isto). Nos outros ela já chega respondida na sessão, do jeito que a
   * própria tela guarda o sim.
   */
  idadeRespondida: [true, { option: true }],

  page: async ({ page, idadeRespondida }, use) => {
    if (idadeRespondida) {
      await page.addInitScript(() => {
        sessionStorage.setItem('bigpuffs:idade:entrada', 'sim')
        sessionStorage.setItem('bigpuffs:idade:compra', 'sim')
      })
    }
    await use(page)
  },

  cliente: async ({ request }, use) => {
    const conta: Conta = {
      email: `cliente-${randomUUID()}@loja.test`,
      senha: 'uma-senha-longa-de-teste',
      nome: 'Cliente',
    }

    const cadastro = await request.post(`${API}/auth/cadastro/`, {
      data: {
        email: conta.email,
        password: conta.senha,
        nome: conta.nome,
      } satisfies Esquema<'CadastroRequest'>,
    })
    expect(cadastro.status(), 'cadastro do cliente').toBe(201)
    const { id } = (await cadastro.json()) as Esquema<'ContaCriada'>

    // A conta nasce desativada, esperando o link que vai por e-mail. Nos
    // testes o e-mail não sai, então quem ativa é a gestão, como um admin faria.
    const ativacao = await request.patch(`${API}/usuarios/${id}/`, {
      data: { ativo: true } satisfies Esquema<'PatchedUsuarioAdminRequest'>,
      headers: { Authorization: `Bearer ${await tokenDoAdmin(request)}` },
    })
    expect(ativacao.ok(), 'ativação do cliente').toBe(true)

    await use(conta)
  },
})

export { expect }

/** Entra pela tela de login, como a pessoa faria. */
export async function entrar(page: Page, conta: Conta): Promise<void> {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(conta.email)
  await page.getByLabel('Senha').fill(conta.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

/**
 * Valor de uma linha de `<dl>` pelo termo: `valorDaLinha(page, 'Total')`.
 *
 * Os valores do pedido são uma lista de definições, e é pelo termo que a
 * pessoa lê qual número é qual.
 */
export function valorDaLinha(page: Page, termo: string) {
  return page.locator(`div:has(> dt:text-is("${termo}")) > dd`)
}
