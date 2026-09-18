import { mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { useRequisicao, type Requisicao } from './useRequisicao'

/**
 * Monta o composable dentro de um componente, que é o que dá a ele o
 * `onMounted` usado pela opção `imediato`.
 */
function montar<T>(buscar: () => Promise<T>, imediato = true): Requisicao<T> {
  let capturado!: Requisicao<T>
  mount(
    defineComponent({
      setup() {
        capturado = useRequisicao(buscar, { imediato })
        return () => h('div')
      },
    }),
  )
  return capturado
}

function erro401(): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const resposta = { status: 401, data: {}, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('falhou', '401', config, {}, resposta)
}

describe('useRequisicao', () => {
  it('começa carregando e guarda o resultado', async () => {
    const requisicao = montar(async () => ['a', 'b'])

    expect(requisicao.carregando.value).toBe(true)
    expect(requisicao.respondeu.value).toBe(false)

    await Promise.resolve()
    await Promise.resolve()

    expect(requisicao.carregando.value).toBe(false)
    expect(requisicao.respondeu.value).toBe(true)
    expect(requisicao.dados.value).toEqual(['a', 'b'])
    expect(requisicao.erro.value).toBeNull()
  })

  it('não busca nada quando imediato é falso', () => {
    const requisicao = montar(async () => 'x', false)

    expect(requisicao.carregando.value).toBe(false)
    expect(requisicao.dados.value).toBeNull()
  })

  it('traduz a falha para ErroDaApi', async () => {
    const requisicao = montar(async () => {
      throw erro401()
    })

    await requisicao.executar()

    expect(requisicao.erro.value?.tipo).toBe('nao_autenticado')
    expect(requisicao.carregando.value).toBe(false)
  })

  it('limpa o erro anterior ao repetir', async () => {
    let deveFalhar = true
    const requisicao = montar(async () => {
      if (deveFalhar) throw erro401()
      return 'ok'
    }, false)

    await requisicao.executar()
    expect(requisicao.erro.value).not.toBeNull()

    deveFalhar = false
    await requisicao.executar()

    expect(requisicao.erro.value).toBeNull()
    expect(requisicao.dados.value).toBe('ok')
  })

  it('descarta a resposta de uma chamada que ficou para trás', async () => {
    const respostas: Array<(valor: string) => void> = []
    const requisicao = montar(
      () => new Promise<string>((resolver) => respostas.push(resolver)),
      false,
    )

    const primeira = requisicao.executar()
    const segunda = requisicao.executar()

    // A segunda chamada responde primeiro; a primeira chega atrasada e não
    // pode sobrescrever o resultado mais novo.
    respostas[1]('nova')
    await segunda
    respostas[0]('antiga')
    await primeira

    expect(requisicao.dados.value).toBe('nova')
  })
})

describe('vazio', () => {
  it('só é verdadeiro depois de responder, sem erro e sem itens', async () => {
    const requisicao = montar(async () => [] as string[], false)

    expect(requisicao.vazio.value).toBe(false)

    await requisicao.executar()

    expect(requisicao.vazio.value).toBe(true)
  })

  it('é falso quando veio conteúdo', async () => {
    const requisicao = montar(async () => ['a'], false)

    await requisicao.executar()

    expect(requisicao.vazio.value).toBe(false)
  })

  it('é falso quando a busca falhou', async () => {
    const requisicao = montar<string[]>(async () => {
      throw erro401()
    }, false)

    await requisicao.executar()

    expect(requisicao.vazio.value).toBe(false)
  })
})
