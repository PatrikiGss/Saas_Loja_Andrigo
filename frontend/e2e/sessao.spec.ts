/**
 * Sessão, do login ao cookie httpOnly e de volta.
 *
 * É o que os dublês não alcançam: o refresh vai e volta em cookie com caminho
 * `/api/auth/`, entre duas portas, e só um navegador de verdade mostra se ele
 * chega, se renova e se morre no logout.
 */
import type { Page } from '@playwright/test'

import { entrar, expect, test } from './apoio'

function respostaDoRefresh(page: Page) {
  return page.waitForResponse((resposta) => resposta.url().endsWith('/api/auth/refresh/'))
}

test('entra, continua dentro depois de recarregar e sai de vez', async ({ page, cliente }) => {
  await entrar(page, cliente)
  await expect(page.getByRole('link', { name: cliente.nome, exact: true })).toBeVisible()

  // O access token vive só em memória e morre aqui. Quem traz a sessão de
  // volta é o refresh, no cookie que o JavaScript não lê.
  const renovacao = respostaDoRefresh(page)
  await page.reload()
  expect((await renovacao).status()).toBe(200)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

  // Sair derruba o refresh no servidor e apaga o cookie: recarregar não
  // ressuscita a sessão.
  const recusa = respostaDoRefresh(page)
  await page.reload()
  expect((await recusa).status()).toBe(401)
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
})

test('senha errada é recusada com o texto de credenciais', async ({ page, cliente }) => {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(cliente.email)
  await page.getByLabel('Senha').fill('nao-e-esta-a-senha')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')
  await expect(page).toHaveURL(/\/entrar$/)
})

test('rota de conta sem sessão pede login e volta para ela', async ({ page, cliente }) => {
  await page.goto('/pedidos')
  await expect(page).toHaveURL(/\/entrar\?destino=/)

  await page.getByLabel('E-mail').fill(cliente.email)
  await page.getByLabel('Senha').fill(cliente.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/pedidos$/)
  await expect(page.getByRole('heading', { name: 'Meus pedidos' })).toBeVisible()
})
