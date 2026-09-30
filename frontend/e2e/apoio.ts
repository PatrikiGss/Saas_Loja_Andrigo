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
const ADMIN = { email: 'admin@loja.test', senha: 'admin-da-suite-e2e' }

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

export async function tokenDoAdmin(api: APIRequestContext): Promise<string> {
  const resposta = await api.post(`${API}/auth/login/`, {
    data: { email: ADMIN.email, password: ADMIN.senha } satisfies Esquema<'LoginRequest'>,
  })
  expect(resposta.ok(), 'login da conta admin da fixture').toBe(true)
  return ((await resposta.json()) as Esquema<'Acesso'>).access
}

/**
 * Cada teste ganha uma conta de cliente nova, com carrinho vazio e sem
 * endereço: nenhum depende do que outro deixou para trás.
 */
export const test = base.extend<{ cliente: Conta }>({
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
