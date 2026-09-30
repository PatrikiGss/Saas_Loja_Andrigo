/**
 * A pergunta de idade, sem resposta prévia: na entrada e antes do carrinho.
 *
 * A saída do site é interceptada — o teste não visita o destino de verdade,
 * só confere que a navegação foi para lá.
 */
import { entrar, expect, test } from './apoio'

test.use({ idadeRespondida: false })

test('quem diz que não tem a idade mínima sai do site', async ({ page }) => {
  await page.route('https://www.google.com/**', (rota) =>
    rota.fulfill({ contentType: 'text/html', body: '<p>fora da loja</p>' }),
  )
  await page.goto('/')

  const pergunta = page.getByRole('dialog', { name: 'Você tem 18 anos ou mais?' })
  await expect(pergunta).toBeVisible()
  await pergunta.getByRole('button', { name: 'Não' }).click()

  await expect(page).toHaveURL('https://www.google.com/')
})

test('quem diz sim entra, e o carrinho pergunta de novo uma vez', async ({ page, cliente }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Sim/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // O sim vale pela sessão: trocar de página não pergunta de novo.
  await entrar(page, cliente)
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('link', { name: 'Carrinho' }).click()
  const pergunta = page.getByRole('dialog')
  await expect(pergunta).toContainText('Antes do carrinho, confirmamos de novo.')
  await expect(page).not.toHaveURL(/\/carrinho$/)
  await pergunta.getByRole('button', { name: /^Sim/ }).click()

  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.getByRole('heading', { name: 'Carrinho', level: 1 })).toBeVisible()

  await page.goto('/catalogo')
  await page.getByRole('link', { name: 'Carrinho' }).click()
  await expect(page).toHaveURL(/\/carrinho$/)
  await expect(page.getByRole('dialog')).toBeHidden()
})
