import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { instalarSessao } from '@/modules/auth/instalar'
import * as servicoAuth from '@/modules/auth/services/auth'
import type { Perfil } from '@/modules/auth/types'
import { ErroDaApi } from '@/services/erros'
import { esquecerSessao } from '@/services/http'

vi.mock('@/modules/auth/services/auth')

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'inicio', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio },
      {
        path: '/admin/produtos',
        name: 'admin-produtos',
        component: Vazio,
        meta: { exigeAutenticacao: true, admin: true },
      },
    ],
  })
}

function comSessao(nivel: Perfil['nivel']): void {
  vi.mocked(servicoAuth.renovarAcesso).mockResolvedValue({ access: 'token' })
  vi.mocked(servicoAuth.buscarPerfil).mockResolvedValue({
    email: 'conta@example.com',
    nome: 'Conta',
    sobrenome: '',
    telefone: '',
    nivel,
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  esquecerSessao()
  vi.mocked(servicoAuth.renovarAcesso).mockReset()
  vi.mocked(servicoAuth.buscarPerfil).mockReset()
})

describe('guard da gestão', () => {
  it('deixa entrar quem a API disse ser admin', async () => {
    comSessao('admin')
    const router = criarRouter()
    instalarSessao(router)

    await router.push('/admin/produtos')

    expect(router.currentRoute.value.name).toBe('admin-produtos')
  })

  it('tira da gestão quem é cliente', async () => {
    comSessao('usuario')
    const router = criarRouter()
    instalarSessao(router)

    await router.push('/admin/produtos')

    expect(router.currentRoute.value.name).toBe('inicio')
  })

  it('manda para o login quem nem entrou', async () => {
    vi.mocked(servicoAuth.renovarAcesso).mockRejectedValue(
      new ErroDaApi('nao_autenticado', 'sessão vencida', 401, {}),
    )
    const router = criarRouter()
    instalarSessao(router)

    await router.push('/admin/produtos')

    expect(router.currentRoute.value.name).toBe('entrar')
  })

  it('o nível é o que a API respondeu, e não algo decidido aqui', async () => {
    // Mesmo que alguém force `ehAdmin` na memória do navegador, cada
    // requisição da gestão passa por `EhAdmin` no backend. O guard organiza a
    // navegação; ele não é a barreira.
    comSessao('usuario')
    const router = criarRouter()
    instalarSessao(router)
    await router.push('/')

    const { useSessao } = await import('@/modules/auth/stores/sessao')
    expect(useSessao().ehAdmin).toBe(false)
  })
})
