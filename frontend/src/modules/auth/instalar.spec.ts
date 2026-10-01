import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErroDaApi } from '@/services/erros'
import * as camadaHttp from '@/services/http'
import { esquecerSessao } from '@/services/http'
import { instalarSessao } from './instalar'
import * as servico from './services/auth'
import { umPerfil } from '../../testes/fixtures'
import { roteadorDeTeste } from '../../testes/roteador'

vi.mock('./services/auth')

const PERFIL = umPerfil()

/** As mesmas metas das rotas reais, sem carregar as views. */
const ROTAS = {
  inicio: '/',
  entrar: { caminho: '/entrar', meta: { apenasVisitante: true } },
  'alterar-senha': { caminho: '/conta/senha', meta: { exigeAutenticacao: true } },
}

function comSessaoValida(): void {
  vi.mocked(servico.renovarAcesso).mockResolvedValue({ access: 'token' })
  vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
}

function semSessao(): void {
  vi.mocked(servico.renovarAcesso).mockRejectedValue(
    new ErroDaApi('nao_autenticado', 'sessão vencida', 401, {}),
  )
}

/**
 * O `encerrar` que a camada HTTP chama quando a renovação falha.
 *
 * Ele é entregue ao `registrarSessao` e fica guardado lá dentro; espiar o
 * registro é o jeito de alcançá-lo sem forçar um 401 de verdade só para isso.
 */
let adaptadorRegistrado: camadaHttp.AdaptadorDeSessao | null = null
let encerrarRegistrado: (() => void) | null = null

async function encerrarPelaCamadaHttp(): Promise<void> {
  encerrarRegistrado?.()
  // O `encerrar` dispara a navegação sem esperar por ela, e o guard que roda
  // em seguida também é assíncrono.
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  esquecerSessao()
  encerrarRegistrado = null
  adaptadorRegistrado = null
  vi.restoreAllMocks()
  vi.spyOn(camadaHttp, 'registrarSessao').mockImplementation((adaptador) => {
    adaptadorRegistrado = adaptador
    encerrarRegistrado = () => adaptador.encerrar()
  })
  vi.mocked(servico.renovarAcesso).mockReset()
  vi.mocked(servico.buscarPerfil).mockReset()
})

describe('guard de rota', () => {
  it('manda para o login quem tenta uma rota protegida sem sessão', async () => {
    semSessao()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)

    await router.push('/conta/senha')

    expect(router.currentRoute.value.name).toBe('entrar')
    // O destino é guardado para a pessoa voltar para onde queria ir.
    expect(router.currentRoute.value.query.destino).toBe('/conta/senha')
  })

  it('deixa passar quem tem sessão restaurada pelo cookie', async () => {
    comSessaoValida()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)

    await router.push('/conta/senha')

    expect(router.currentRoute.value.name).toBe('alterar-senha')
  })

  it('espera a restauração antes de decidir, para recarregar não deslogar', async () => {
    // O access token só existe em memória; ao recarregar, a sessão vem do
    // cookie. Decidir antes disso jogaria todo mundo para o login.
    let liberar!: (valor: { access: string }) => void
    vi.mocked(servico.renovarAcesso).mockReturnValue(
      new Promise((resolver) => (liberar = resolver)),
    )
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)

    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)

    const navegacao = router.push('/conta/senha')
    liberar({ access: 'token' })
    await navegacao

    expect(router.currentRoute.value.name).toBe('alterar-senha')
  })

  it('tira de tela de visitante quem já está autenticado', async () => {
    comSessaoValida()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)

    await router.push('/entrar')

    expect(router.currentRoute.value.name).toBe('inicio')
  })

  it('deixa a vitrine aberta para quem não entrou', async () => {
    semSessao()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('inicio')
  })
})

describe('adaptador entregue à camada HTTP', () => {
  it('expõe o token guardado na sessão e sabe renovar', async () => {
    comSessaoValida()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)
    await router.push('/')

    const adaptador = adaptadorRegistrado!
    expect(adaptador.tokenDeAcesso()).toBe('token')

    vi.mocked(servico.renovarAcesso).mockResolvedValue({ access: 'token-novo' })
    expect(await adaptador.renovar()).toBe('token-novo')
    expect(adaptador.tokenDeAcesso()).toBe('token-novo')
  })

  it('devolve nada quando não há sessão para renovar', async () => {
    semSessao()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)
    await router.push('/')

    expect(adaptadorRegistrado!.tokenDeAcesso()).toBeNull()
    expect(await adaptadorRegistrado!.renovar()).toBeNull()
  })
})

describe('sessão que cai no meio do uso', () => {
  it('tira a pessoa da rota protegida, guardando onde ela estava', async () => {
    comSessaoValida()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)
    await router.push('/conta/senha')

    // O interceptador chama isto quando a renovação falha.
    vi.mocked(servico.renovarAcesso).mockRejectedValue(
      new ErroDaApi('nao_autenticado', 'sessão vencida', 401, {}),
    )
    const { useSessao } = await import('./stores/sessao')
    await useSessao().renovar()
    await encerrarPelaCamadaHttp()

    expect(router.currentRoute.value.name).toBe('entrar')
    expect(router.currentRoute.value.query.destino).toBe('/conta/senha')
  })

  it('não muda de página quando a sessão cai na vitrine', async () => {
    // Na loja aberta, a sessão cair não é motivo para tirar ninguém do lugar.
    comSessaoValida()
    const router = roteadorDeTeste(ROTAS)
    instalarSessao(router)
    await router.push('/')

    await encerrarPelaCamadaHttp()

    expect(router.currentRoute.value.name).toBe('inicio')
  })
})
