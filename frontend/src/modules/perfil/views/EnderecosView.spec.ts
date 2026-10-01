import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as servico from '@/modules/enderecos/services/enderecos'
import { umEndereco } from '@/testes/fixtures'
import EnderecosView from './EnderecosView.vue'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('@/modules/enderecos/services/enderecos')

const CASA = umEndereco()

const ROTAS = {
  conta: '/conta',
  'conta-enderecos': '/conta/enderecos',
  'alterar-senha': '/conta/senha',
}

async function montar() {
  return (await montarNaRota(EnderecosView, '/conta/enderecos', ROTAS)).tela
}

async function clicar(tela: Awaited<ReturnType<typeof montar>>, texto: string) {
  const botao = tela.findAll('button').find((item) => item.text().includes(texto))
  await botao!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(servico.listarEnderecos).mockReset().mockResolvedValue([CASA])
  vi.mocked(servico.criarEndereco).mockReset().mockResolvedValue(CASA)
  vi.mocked(servico.atualizarEndereco).mockReset().mockResolvedValue(CASA)
  vi.mocked(servico.removerEndereco).mockReset().mockResolvedValue()
  vi.mocked(servico.consultarCep).mockReset()
})

describe('EnderecosView', () => {
  it('lista os endereços com o CEP legível', async () => {
    const tela = await montar()

    expect(tela.text()).toContain('Casa')
    expect(tela.text()).toContain('Praça da Sé, 100')
    expect(tela.text()).toContain('01001-000')
  })

  it('convida a cadastrar quando não há nenhum', async () => {
    vi.mocked(servico.listarEnderecos).mockResolvedValue([])

    const tela = await montar()

    expect(tela.text()).toContain('Nenhum endereço cadastrado')
  })

  it('abre o formulário preenchido ao editar', async () => {
    const tela = await montar()

    await clicar(tela, 'Editar')

    expect(tela.text()).toContain('Editar endereço')
    const rua = tela.findAll('.campo').find((c) => c.text().startsWith('Rua'))!
    expect((rua.get('input').element as HTMLInputElement).value).toBe('Praça da Sé')
  })

  it('edita pelo id do endereço, e não cria outro', async () => {
    const tela = await montar()
    await clicar(tela, 'Editar')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.atualizarEndereco).toHaveBeenCalledWith(CASA.id, expect.anything())
    expect(servico.criarEndereco).not.toHaveBeenCalled()
  })

  it('cria um novo quando o formulário foi aberto vazio', async () => {
    const tela = await montar()
    await clicar(tela, 'Cadastrar outro endereço')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.criarEndereco).toHaveBeenCalledTimes(1)
    expect(servico.atualizarEndereco).not.toHaveBeenCalled()
  })

  it('pede confirmação antes de remover', async () => {
    const tela = await montar()

    await clicar(tela, 'Remover')

    // Só abriu o diálogo: nada saiu para a API ainda.
    expect(servico.removerEndereco).not.toHaveBeenCalled()
    expect(tela.text()).toContain('Remover este endereço?')
  })

  it('explica que os pedidos antigos não mudam', async () => {
    // O pedido guarda uma cópia própria do destino; apagar o cadastro não
    // mexe no histórico, e a pessoa precisa saber disso antes de confirmar.
    const tela = await montar()

    await clicar(tela, 'Remover')

    expect(tela.text()).toContain('não mudam')
  })

  it('remove e recarrega a lista ao confirmar', async () => {
    const tela = await montar()
    await clicar(tela, 'Remover')

    await clicar(tela, 'Remover endereço')

    expect(servico.removerEndereco).toHaveBeenCalledWith(CASA.id)
    expect(vi.mocked(servico.listarEnderecos).mock.calls.length).toBeGreaterThan(1)
  })
})
