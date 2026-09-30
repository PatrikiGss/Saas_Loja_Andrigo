import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as servico from '../services/enderecos'
import FormularioDeEndereco from './FormularioDeEndereco.vue'
import type { Endereco } from '../types'

vi.mock('../services/enderecos')

const ENDERECO: Endereco = {
  id: 1,
  apelido: 'Casa',
  cep: '01001000',
  logradouro: 'Praça da Sé',
  numero: '100',
  complemento: 'lado ímpar',
  bairro: 'Sé',
  cidade: 'São Paulo',
  uf: 'SP',
}

function montar(props: Record<string, unknown> = {}) {
  return mount(FormularioDeEndereco, { props })
}

function campoDe(formulario: ReturnType<typeof montar>, rotulo: string) {
  return formulario.findAll('.campo').find((bloco) => bloco.text().startsWith(rotulo))!
}

/** Preenche pelo rótulo, que é como a pessoa encontra o campo. */
async function preencher(
  formulario: ReturnType<typeof montar>,
  rotulo: string,
  valor: string,
): Promise<void> {
  await campoDe(formulario, rotulo).get('input').setValue(valor)
}

/**
 * Lê o que está no campo.
 *
 * Pelo elemento, e não pelo HTML: o `v-model` escreve na propriedade `value`,
 * e o atributo no markup continua vazio.
 */
function valorDe(formulario: ReturnType<typeof montar>, rotulo: string): string {
  return (campoDe(formulario, rotulo).get('input').element as HTMLInputElement).value
}

beforeEach(() => {
  vi.mocked(servico.consultarCep).mockReset()
})

describe('FormularioDeEndereco', () => {
  it('manda o CEP só com dígitos, como o backend valida', async () => {
    const formulario = montar()

    await preencher(formulario, 'CEP', '01001-000')
    await preencher(formulario, 'Rua', 'Praça da Sé')
    await preencher(formulario, 'Número', '100')
    await preencher(formulario, 'Bairro', 'Sé')
    await preencher(formulario, 'Cidade', 'São Paulo')
    await formulario.get('select').setValue('SP')
    await formulario.get('form').trigger('submit')

    const enviado = formulario.emitted('enviar')?.[0][0] as Record<string, string>
    expect(enviado.cep).toBe('01001000')
    expect(enviado.uf).toBe('SP')
  })

  it('preenche o endereço com o que o provedor devolveu', async () => {
    vi.mocked(servico.consultarCep).mockResolvedValue({
      cep: '01001000',
      logradouro: 'Praça da Sé',
      complemento: 'lado ímpar',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    })
    const formulario = montar()

    await preencher(formulario, 'CEP', '01001000')
    await formulario
      .findAll('button')
      .find((b) => b.text().includes('Buscar CEP'))!
      .trigger('click')
    await flushPromises()

    expect((formulario.get('select').element as HTMLSelectElement).value).toBe('SP')
    expect(valorDe(formulario, 'Rua')).toBe('Praça da Sé')
    expect(valorDe(formulario, 'Bairro')).toBe('Sé')
    expect(valorDe(formulario, 'Cidade')).toBe('São Paulo')
  })

  it('mantém a UF escolhida quando o provedor devolve sigla que o backend não aceita', async () => {
    vi.mocked(servico.consultarCep).mockResolvedValue({
      cep: '01001000',
      logradouro: 'Praça da Sé',
      complemento: '',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'XX',
    })
    const formulario = montar()
    await formulario.get('select').setValue('RJ')

    await preencher(formulario, 'CEP', '01001000')
    await formulario
      .findAll('button')
      .find((b) => b.text().includes('Buscar CEP'))!
      .trigger('click')
    await flushPromises()

    expect((formulario.get('select').element as HTMLSelectElement).value).toBe('RJ')
    expect(valorDe(formulario, 'Rua')).toBe('Praça da Sé')
  })

  it('oferece as 27 unidades da federação', () => {
    const formulario = montar()

    // A primeira opção é o "Escolha", desabilitado.
    const siglas = formulario.findAll('option').map((opcao) => opcao.attributes('value'))
    expect(siglas).toHaveLength(28)
    expect(siglas.slice(1, 3)).toEqual(['AC', 'AL'])
    expect(siglas.at(-1)).toBe('TO')
  })

  it('recusa buscar CEP incompleto sem gastar a chamada', async () => {
    const formulario = montar()

    await preencher(formulario, 'CEP', '0100')
    await formulario
      .findAll('button')
      .find((b) => b.text().includes('Buscar CEP'))!
      .trigger('click')
    await flushPromises()

    // O endpoint tem limite de 30 por minuto; não vale queimar numa entrada
    // que já se sabe inválida.
    expect(servico.consultarCep).not.toHaveBeenCalled()
    expect(formulario.text()).toContain('oito dígitos')
  })

  it('deixa preencher à mão quando a busca de CEP falha', async () => {
    const config = { headers: new AxiosHeaders() }
    vi.mocked(servico.consultarCep).mockRejectedValue(
      new AxiosError('falhou', '400', config, {}, {
        status: 400,
        data: { cep: ['CEP não encontrado.'] },
        statusText: '',
        headers: {},
        config,
      } as AxiosResponse),
    )
    const formulario = montar()

    await preencher(formulario, 'CEP', '99999999')
    await formulario
      .findAll('button')
      .find((b) => b.text().includes('Buscar CEP'))!
      .trigger('click')
    await flushPromises()

    expect(formulario.text()).toContain('CEP não encontrado.')
    // O formulário continua utilizável: nada foi travado.
    expect(formulario.get('form').findAll('input[disabled]')).toHaveLength(0)
  })

  it('começa preenchido quando recebe um endereço para editar', () => {
    const formulario = montar({ valorInicial: ENDERECO })

    expect((formulario.get('select').element as HTMLSelectElement).value).toBe('SP')
    expect(valorDe(formulario, 'Rua')).toBe('Praça da Sé')
    expect(valorDe(formulario, 'Número')).toBe('100')
    expect(valorDe(formulario, 'Apelido')).toBe('Casa')
  })

  it('mostra o erro que o backend devolveu por campo', () => {
    const formulario = montar({ campos: { uf: 'Faça uma escolha válida.' } })

    expect(formulario.text()).toContain('Faça uma escolha válida.')
    expect(formulario.get('select').attributes('aria-invalid')).toBe('true')
  })
})
