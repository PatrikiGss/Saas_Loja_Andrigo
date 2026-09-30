/**
 * O pedido depois de fechado: o cliente desistindo, e a gestão movendo.
 *
 * O que se confere aqui é o encaixe das regras do servidor com a tela:
 * `pode_cancelar` decide se o botão aparece, e `proximos_status` decide o que
 * o seletor da gestão oferece.
 */
import { ADMIN, entrar, expect, pedidoAguardandoPagamento, test } from './apoio'

test('cliente cancela o pedido que espera pagamento', async ({ page, request, cliente }) => {
  const numero = await pedidoAguardandoPagamento(request, cliente)
  await entrar(page, cliente)
  await page.goto(`/pedidos/${numero}`)

  await page.getByRole('button', { name: 'Cancelar pedido' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText('Cancelar este pedido?')
  await dialogo.getByRole('button', { name: 'Cancelar pedido' }).click()

  await expect(page.getByText('não segue para entrega')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toBeHidden()

  // Relendo do servidor, e não do estado da tela.
  await page.goto('/pedidos')
  await expect(page.getByRole('listitem').filter({ hasText: numero })).toContainText('Cancelado')
})

test('a gestão vê de quem é o pedido e só os status que valem', async ({
  page,
  request,
  cliente,
}) => {
  const numero = await pedidoAguardandoPagamento(request, cliente)
  await entrar(page, ADMIN)
  await page.goto('/admin/pedidos')

  const linha = page.getByRole('row').filter({ hasText: numero })
  await expect(linha).toContainText(cliente.email)

  const seletor = linha.getByRole('combobox')
  await expect(seletor.getByRole('option')).toHaveText(['Escolha', 'Pago', 'Cancelado'])

  await seletor.selectOption('pago')
  await linha.getByRole('button', { name: 'Aplicar' }).click()

  // Depois de pago, a lista relida do servidor oferece o passo seguinte. (O
  // texto 'Pago' sozinho não provaria nada: ele já estava entre as opções.)
  await expect(seletor.getByRole('option')).toHaveText(['Escolha', 'Em preparação', 'Cancelado'])
})
