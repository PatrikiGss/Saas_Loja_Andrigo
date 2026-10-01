import { describe, expect, it, vi } from 'vitest'

import { useFormulario } from './useFormulario'
import { falhaComResposta } from '../testes/falhas'

describe('useFormulario', () => {
  it('marca o envio e devolve o resultado', async () => {
    const formulario = useFormulario(async () => 'pronto')

    const resultado = await formulario.submeter()

    expect(resultado).toBe('pronto')
    expect(formulario.enviando.value).toBe(false)
    expect(formulario.erro.value).toBeNull()
  })

  it('separa erro por campo do erro geral', async () => {
    const formulario = useFormulario(async () => {
      throw falhaComResposta(400, {
        password: ['Senha comum demais.'],
        detail: 'Confira o cadastro.',
      })
    })

    await formulario.submeter()

    expect(formulario.campos.value).toEqual({ password: 'Senha comum demais.' })
    expect(formulario.erro.value?.message).toBe('Confira o cadastro.')
  })

  it('recusa o segundo envio enquanto o primeiro não termina', async () => {
    let liberar!: () => void
    const enviar = vi.fn(() => new Promise<void>((resolver) => (liberar = resolver)))
    const formulario = useFormulario(enviar)

    const primeiro = formulario.submeter()
    const segundo = formulario.submeter()

    expect(await segundo).toBeNull()
    expect(enviar).toHaveBeenCalledTimes(1)

    liberar()
    await primeiro
  })

  it('libera um novo envio depois que o anterior falha', async () => {
    let deveFalhar = true
    const formulario = useFormulario(async () => {
      if (deveFalhar) throw falhaComResposta(400, { email: ['Já cadastrado.'] })
      return 'ok'
    })

    await formulario.submeter()
    expect(formulario.campos.value.email).toBe('Já cadastrado.')

    deveFalhar = false
    const resultado = await formulario.submeter()

    expect(resultado).toBe('ok')
    expect(formulario.campos.value).toEqual({})
    expect(formulario.erro.value).toBeNull()
  })

  it('não vaza detalhe de 500 para a tela', async () => {
    const formulario = useFormulario(async () => {
      throw falhaComResposta(500, '<html>Traceback...</html>')
    })

    await formulario.submeter()

    expect(formulario.erro.value?.message).not.toContain('Traceback')
  })
})
