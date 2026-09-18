import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ErroDaApi } from './erros'
import { esquecerSessao, http, registrarSessao, type AdaptadorDeSessao } from './http'

const adaptadorOriginal = http.defaults.adapter

/**
 * Troca a rede por uma função.
 *
 * `respostas` é consumida em ordem: o primeiro número é o status da primeira
 * requisição que chegar, e assim por diante. É o que permite descrever
 * "falha com 401 e depois responde 200" sem subir servidor.
 */
function simularRespostas(respostas: number[]): { enviadas: InternalAxiosRequestConfig[] } {
  const enviadas: InternalAxiosRequestConfig[] = []

  const adaptador: AxiosAdapter = (config) => {
    enviadas.push(config)
    const status = respostas.shift() ?? 200

    if (status >= 400) {
      return Promise.reject(
        new AxiosError('falhou', String(status), config, {}, {
          status,
          data: {},
          statusText: '',
          headers: {},
          config,
        } as never),
      )
    }

    return Promise.resolve({ status, data: { ok: true }, statusText: '', headers: {}, config })
  }

  http.defaults.adapter = adaptador
  return { enviadas }
}

function sessaoFalsa(parcial: Partial<AdaptadorDeSessao> = {}): AdaptadorDeSessao {
  return {
    tokenDeAcesso: () => 'token-antigo',
    renovar: async () => 'token-novo',
    encerrar: () => {},
    ...parcial,
  }
}

afterEach(() => {
  esquecerSessao()
  http.defaults.adapter = adaptadorOriginal
  vi.restoreAllMocks()
})

describe('http', () => {
  it('não manda Authorization quando ninguém está autenticado', async () => {
    const { enviadas } = simularRespostas([200])

    await http.get('/subtipos/')

    expect(enviadas[0].headers.Authorization).toBeUndefined()
  })

  it('manda o token de acesso da sessão', async () => {
    const { enviadas } = simularRespostas([200])
    registrarSessao(sessaoFalsa())

    await http.get('/perfil/')

    expect(enviadas[0].headers.Authorization).toBe('Bearer token-antigo')
  })

  it('renova e repete a requisição com o token novo', async () => {
    const { enviadas } = simularRespostas([401, 200])
    // Sessão de verdade guarda o token antes de resolver a renovação; é esse
    // o contrato de `AdaptadorDeSessao.renovar`.
    let token = 'token-antigo'
    const renovar = vi.fn(async () => {
      token = 'token-novo'
      return token
    })
    registrarSessao(sessaoFalsa({ tokenDeAcesso: () => token, renovar }))

    const resposta = await http.get('/perfil/')

    expect(renovar).toHaveBeenCalledTimes(1)
    expect(resposta.status).toBe(200)
    expect(enviadas[0].headers.Authorization).toBe('Bearer token-antigo')
    expect(enviadas[1].headers.Authorization).toBe('Bearer token-novo')
  })

  it('renova uma vez só quando várias requisições tomam 401 juntas', async () => {
    // O backend rotaciona o refresh token a cada uso: dois refresh simultâneos
    // fariam o segundo chegar com um token já na blacklist e derrubariam a
    // sessão de quem estava logado.
    simularRespostas([401, 401, 401, 200, 200, 200])
    const renovar = vi.fn(async () => 'token-novo')
    registrarSessao(sessaoFalsa({ renovar }))

    await Promise.all([http.get('/perfil/'), http.get('/carrinho/'), http.get('/pedidos/')])

    expect(renovar).toHaveBeenCalledTimes(1)
  })

  it('encerra a sessão quando a renovação não devolve token', async () => {
    simularRespostas([401])
    const encerrar = vi.fn()
    registrarSessao(sessaoFalsa({ renovar: async () => null, encerrar }))

    await expect(http.get('/perfil/')).rejects.toBeInstanceOf(ErroDaApi)

    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it('desiste depois de uma renovação, sem entrar em laço', async () => {
    const { enviadas } = simularRespostas([401, 401])
    const renovar = vi.fn(async () => 'token-novo')
    registrarSessao(sessaoFalsa({ renovar }))

    await expect(http.get('/perfil/')).rejects.toBeInstanceOf(ErroDaApi)

    expect(renovar).toHaveBeenCalledTimes(1)
    expect(enviadas).toHaveLength(2)
  })

  it('não tenta renovar nas rotas marcadas como semRenovacao', async () => {
    simularRespostas([401])
    const renovar = vi.fn(async () => 'token-novo')
    registrarSessao(sessaoFalsa({ renovar }))

    await expect(
      http.post('/auth/login/', {}, { semRenovacao: true } as never),
    ).rejects.toBeInstanceOf(ErroDaApi)

    expect(renovar).not.toHaveBeenCalled()
  })

  it('entrega sempre ErroDaApi, e não o erro cru do axios', async () => {
    simularRespostas([500])

    const falha = await http.get('/produtos/').catch((erro: unknown) => erro)

    expect(falha).toBeInstanceOf(ErroDaApi)
    expect((falha as ErroDaApi).tipo).toBe('servidor')
  })
})
