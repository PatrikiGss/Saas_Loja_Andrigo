import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as servico from '@/modules/enderecos/services/enderecos'
import type { Endereco } from '@/modules/enderecos/types'
import SelecaoDeEndereco from './SelecaoDeEndereco.vue'

vi.mock('@/modules/enderecos/services/enderecos')

const CASA: Endereco = {
  id: 1,
  apelido: 'Casa',
  cep: '01001000',
  logradouro: 'Praça da Sé',
  numero: '100',
  complemento: 'fundos',
  bairro: 'Sé',
  cidade: 'São Paulo',
  uf: 'SP',
}

function montar(props: Record<string, unknown> = {}) {
  return mount(SelecaoDeEndereco, {
    props: { enderecos: [CASA], selecionado: CASA.id, ...props },
  })
}

async function clicar(tela: ReturnType<typeof montar>, texto: string) {
  await tela.findAll('button').find((b) => b.text().includes(texto))!.trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.mocked(servico.criarEndereco).mockReset().mockResolvedValue({ ...CASA, id: 2 })
  vi.mocked(servico.consultarCep).mockReset()
})

describe('SelecaoDeEndereco', () => {
  it('lista o endereço com CEP legível e complemento', () => {
    const tela = montar()

    expect(tela.text()).toContain('Casa')
    expect(tela.text()).toContain('Praça da Sé, 100, fundos')
    expect(tela.text()).toContain('São Paulo/SP')
    expect(tela.text()).toContain('01001-000')
  })

  it('cai direto no formulário quando não há endereço cadastrado', () => {
    // Uma lista vazia no meio do caminho não ajudaria ninguém.
    const tela = montar({ enderecos: [], selecionado: null })

    expect(tela.find('form').exists()).toBe(true)
    expect(tela.findAll('.opcao')).toHaveLength(0)
  })

  it('não deixa continuar sem escolher', () => {
    const tela = montar({ selecionado: null })
    const continuar = tela.findAll('button').find((b) => b.text().includes('Continuar'))!

    expect(continuar.attributes('disabled')).toBeDefined()
  })

  it('avisa qual endereço foi escolhido', async () => {
    const tela = montar({ selecionado: null })

    await tela.get('input[type="radio"]').setValue()

    expect(tela.emitted('escolher')).toEqual([[CASA.id]])
  })

  it('segue para a entrega', async () => {
    const tela = montar()

    await clicar(tela, 'Continuar')

    expect(tela.emitted('continuar')).toHaveLength(1)
  })

  it('abre o cadastro e oferece cancelar quem já tem endereço', async () => {
    const tela = montar()

    await clicar(tela, 'Usar outro endereço')
    expect(tela.find('form').exists()).toBe(true)

    await clicar(tela, 'Cancelar')
    expect(tela.find('form').exists()).toBe(false)
  })

  it('não oferece cancelar a quem ainda não tem nenhum', () => {
    const tela = montar({ enderecos: [], selecionado: null })

    expect(tela.findAll('button').some((b) => b.text().includes('Cancelar'))).toBe(false)
  })

  it('cria o endereço e avisa quem chamou', async () => {
    const tela = montar({ enderecos: [], selecionado: null })

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.criarEndereco).toHaveBeenCalledTimes(1)
    expect(tela.emitted('criado')?.[0][0]).toMatchObject({ id: 2 })
  })

  it('mostra a recusa do backend sem perder o que foi digitado', async () => {
    const config = { headers: new AxiosHeaders() }
    vi.mocked(servico.criarEndereco).mockRejectedValue(
      new AxiosError('falhou', '400', config, {}, {
        status: 400,
        data: { cep: ['Informe o CEP com 8 dígitos, apenas números.'] },
        statusText: '',
        headers: {},
        config,
      } as AxiosResponse),
    )
    const tela = montar({ enderecos: [], selecionado: null })

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).toContain('Informe o CEP com 8 dígitos')
    expect(tela.find('form').exists()).toBe(true)
  })
})
