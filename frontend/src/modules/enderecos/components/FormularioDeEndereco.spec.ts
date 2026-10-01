import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as servico from '../services/enderecos'
import FormularioDeEndereco from './FormularioDeEndereco.vue'
import { falhaComResposta, falhaSemResposta } from '../../../testes/falhas'
import { umEndereco } from '../../../testes/fixtures'

vi.mock('../services/enderecos')

const ENDERECO = umEndereco({ complemento: 'lado ímpar' })

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

  it('com CEP geral da cidade, mantém a rua e o bairro que a pessoa digitou', async () => {
    // Para CEP de cidade inteira o provedor devolve rua e bairro vazios.
    vi.mocked(servico.consultarCep).mockResolvedValue({
      cep: '13100000',
      logradouro: '',
      complemento: '',
      bairro: '',
      cidade: 'Campinas',
      uf: 'SP',
    })
    const formulario = montar()
    await preencher(formulario, 'Rua', 'Rua das Flores')
    await preencher(formulario, 'Bairro', 'Centro')

    await preencher(formulario, 'CEP', '13100000')
    await formulario
      .findAll('button')
      .find((b) => b.text().includes('Buscar CEP'))!
      .trigger('click')
    await flushPromises()

    expect(valorDe(formulario, 'Rua')).toBe('Rua das Flores')
    expect(valorDe(formulario, 'Bairro')).toBe('Centro')
    expect(valorDe(formulario, 'Cidade')).toBe('Campinas')
  })

  it('sem conexão na busca de CEP, diz isso no campo', async () => {
    vi.mocked(servico.consultarCep).mockRejectedValue(falhaSemResposta())
    const formulario = montar()

    await preencher(formulario, 'CEP', '01001000')
    await formulario
      .findAll('button')
      .find((b) => b.text().includes('Buscar CEP'))!
      .trigger('click')
    await flushPromises()

    expect(campoDe(formulario, 'CEP').text()).toContain('conexão')
  })

  it('deixa preencher à mão quando a busca de CEP falha', async () => {
    vi.mocked(servico.consultarCep).mockRejectedValue(
      falhaComResposta(400, { cep: ['CEP não encontrado.'] }),
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
