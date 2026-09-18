import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ErroDaApi } from '@/services/erros'
import { esquecerSessao } from '@/services/http'
import { instalarSessao } from './instalar'
import * as servico from './services/auth'
import type { Perfil } from './types'

vi.mock('./services/auth')

const PERFIL: Perfil = {
  email: 'cliente@example.com',
  nome: 'Ana',
  sobrenome: '',
  telefone: '',
  nivel: 'usuario',
}

const Vazio = defineComponent({ setup: () => () => h('div') })

/** Router com as mesmas metas das rotas reais, sem carregar as views. */
function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'inicio', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio, meta: { apenasVisitante: true } },
      {
        path: '/conta/senha',
        name: 'alterar-senha',
        component: Vazio,
        meta: { exigeAutenticacao: true },
      },
    ],
  })
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

beforeEach(() => {
  setActivePinia(createPinia())
  esquecerSessao()
  vi.mocked(servico.renovarAcesso).mockReset()
  vi.mocked(servico.buscarPerfil).mockReset()
})

describe('guard de rota', () => {
  it('manda para o login quem tenta uma rota protegida sem sessão', async () => {
    semSessao()
    const router = criarRouter()
    instalarSessao(router)

    await router.push('/conta/senha')

    expect(router.currentRoute.value.name).toBe('entrar')
    // O destino é guardado para a pessoa voltar para onde queria ir.
    expect(router.currentRoute.value.query.destino).toBe('/conta/senha')
  })

  it('deixa passar quem tem sessão restaurada pelo cookie', async () => {
    comSessaoValida()
    const router = criarRouter()
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

    const router = criarRouter()
    instalarSessao(router)

    const navegacao = router.push('/conta/senha')
    liberar({ access: 'token' })
    await navegacao

    expect(router.currentRoute.value.name).toBe('alterar-senha')
  })

  it('tira de tela de visitante quem já está autenticado', async () => {
    comSessaoValida()
    const router = criarRouter()
    instalarSessao(router)

    await router.push('/entrar')

    expect(router.currentRoute.value.name).toBe('inicio')
  })

  it('deixa a vitrine aberta para quem não entrou', async () => {
    semSessao()
    const router = criarRouter()
    instalarSessao(router)

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('inicio')
  })
})
