/**
 * Compra, do catálogo ao pedido registrado.
 *
 * Cada passo aqui já tem teste de unidade com dublê. O que só este teste pega
 * é o encaixe: o id que o catálogo manda é o que o carrinho aceita, o total
 * que a tela estima é o que o servidor cobra, e o pedido fechado aparece na
 * lista e esvazia o carrinho.
 */
import { PRODUTO, entrar, expect, test, valorDaLinha } from './apoio'

test('compra do catálogo ao pedido registrado', async ({ page, cliente }) => {
  await entrar(page, cliente)

  await test.step('acha o produto pela busca do catálogo', async () => {
    await page.goto('/catalogo')
    const busca = page.getByRole('searchbox', { name: 'Buscar por nome, marca ou SKU' })
    await busca.fill(PRODUTO.nome)
    await busca.press('Enter')
    await page.getByRole('link', { name: PRODUTO.nome }).click()

    await expect(page.getByRole('heading', { level: 1, name: PRODUTO.nome })).toBeVisible()
  })

  await test.step('põe duas unidades no carrinho', async () => {
    await page.getByLabel('Quantidade').fill('2')
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()

    await expect(page.getByRole('status')).toContainText('Adicionado ao carrinho')
    await expect(page.getByRole('link', { name: /Carrinho\s*2\s*itens/ })).toBeVisible()
  })

  await test.step('o carrinho mostra o total calculado pelo servidor', async () => {
    await page.getByRole('link', { name: 'Ver carrinho' }).click()

    await expect(page.getByRole('heading', { name: PRODUTO.nome })).toBeVisible()
    await expect(page.getByRole('main')).toContainText(/Total\s*R\$\s*299,80/)
  })

  await test.step('cadastra o endereço de entrega no fechamento', async () => {
    await page.getByRole('button', { name: 'Fechar pedido' }).click()
    await expect(page).toHaveURL(/\/checkout$/)

    // Conta nova não tem endereço, então o formulário já vem aberto. A busca
    // de CEP fica de fora: ela depende de um provedor externo.
    await page.getByLabel('CEP').fill('01001000')
    await page.getByLabel('Rua').fill('Praça da Sé')
    await page.getByLabel('Número').fill('100')
    await page.getByLabel('Bairro').fill('Sé')
    await page.getByLabel('Cidade').fill('São Paulo')
    await page.getByLabel('Estado').selectOption('SP')
    await page.getByRole('button', { name: 'Usar este endereço' }).click()
  })

  await test.step('escolhe o frete cotado pelo servidor', async () => {
    await page.getByRole('radio', { name: /Econômico/ }).check()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await expect(page.getByRole('heading', { name: 'Confira antes de fechar' })).toBeVisible()
  })

  const estimado = {
    subtotal: await valorDaLinha(page, 'Subtotal').textContent(),
    frete: await valorDaLinha(page, 'Frete').textContent(),
    total: await valorDaLinha(page, 'Total').textContent(),
  }
  expect(estimado.subtotal).toMatch(/R\$\s*299,80/)

  let numero = ''
  await test.step('fecha o pedido, e o servidor cobra o que a tela estimou', async () => {
    await page.getByRole('button', { name: 'Fechar pedido' }).click()

    await expect(page.getByRole('heading', { name: 'Pedido registrado' })).toBeVisible()
    await expect(valorDaLinha(page, 'Subtotal')).toHaveText(estimado.subtotal!)
    await expect(valorDaLinha(page, 'Frete')).toHaveText(estimado.frete!)
    await expect(valorDaLinha(page, 'Total')).toHaveText(estimado.total!)

    const acompanhar = page.getByRole('link', { name: 'Acompanhar este pedido' })
    numero = (await acompanhar.getAttribute('href'))!.split('/').filter(Boolean).at(-1)!
    expect(numero).not.toBe('')
  })

  await test.step('o pedido aparece na lista, aguardando pagamento', async () => {
    await page.goto('/pedidos')
    const linha = page.getByRole('listitem').filter({ hasText: numero })

    await expect(linha).toContainText('Aguardando pagamento')
    await expect(linha).toContainText(estimado.total!.trim())
  })

  await test.step('o carrinho foi esvaziado pelo fechamento', async () => {
    await page.goto('/carrinho')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })
})
