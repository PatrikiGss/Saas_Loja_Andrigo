/**
 * As seis telas de conta, num arquivo só.
 *
 * Elas dividem a mesma montagem — roteador de memória, Pinia limpo e o
 * serviço de autenticação substituído — e separá-las em seis arquivos
 * repetiria esse preparo seis vezes sem acrescentar nada.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSessao } from '../stores/sessao'
import type { Perfil } from '../types'
import * as servico from '../services/auth'
import AlterarSenhaView from './AlterarSenhaView.vue'
import AtivarContaView from './AtivarContaView.vue'
import CadastroView from './CadastroView.vue'
import LoginView from './LoginView.vue'
import RecuperarSenhaView from './RecuperarSenhaView.vue'
import RedefinirSenhaView from './RedefinirSenhaView.vue'

vi.mock('../services/auth')

const PERFIL: Perfil = {
  email: 'ana@example.com',
  nome: 'Ana',
  sobrenome: 'Lima',
  telefone: '',
  nivel: 'usuario',
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'inicio', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio },
      { path: '/criar-conta', name: 'criar-conta', component: Vazio },
      { path: '/recuperar-senha', name: 'recuperar-senha', component: Vazio },
      { path: '/ativar/:uid/:token', name: 'ativar-conta', component: Vazio },
      { path: '/redefinir-senha/:uid/:token', name: 'redefinir-senha', component: Vazio },
      { path: '/conta', name: 'conta', component: Vazio },
      { path: '/conta/enderecos', name: 'conta-enderecos', component: Vazio },
      { path: '/conta/senha', name: 'alterar-senha', component: Vazio },
      { path: '/pedidos', name: 'pedidos', component: Vazio },
    ],
  })
}

async function montar(tela: Component, caminho: string) {
  const router = criarRouter()
  await router.push(caminho)
  await router.isReady()

  const montada = mount(tela, { global: { plugins: [router] } })
  await flushPromises()
  return { montada, router }
}

function campoDe(tela: ReturnType<typeof mount>, rotulo: string) {
  return tela.findAll('.campo').find((bloco) => bloco.text().startsWith(rotulo))!
}

async function preencher(tela: ReturnType<typeof mount>, rotulo: string, valor: string) {
  await campoDe(tela, rotulo).get('input').setValue(valor)
}

function erroDeApi(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('falhou', String(status), config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
  vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
})

describe('LoginView', () => {
  it('entra e volta para a raiz quando não havia destino', async () => {
    const { montada, router } = await montar(LoginView, '/entrar')

    await preencher(montada, 'E-mail', 'ana@example.com')
    await preencher(montada, 'Senha', 'Senha-Forte')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servico.autenticar).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'Senha-Forte',
    })
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('volta para onde a pessoa queria ir', async () => {
    const { montada, router } = await montar(LoginView, '/entrar?destino=/pedidos')

    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/pedidos')
  })

  it('recusa destino que aponta para fora', async () => {
    const { montada, router } = await montar(LoginView, '/entrar?destino=//exemplo-hostil.test')

    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('diz que a credencial foi recusada, e não que a sessão expirou', async () => {
    vi.mocked(servico.autenticar).mockRejectedValue(
      Object.assign(new Error('x'), {
        tipo: 'credenciais',
        message: 'E-mail ou senha incorretos.',
        campos: {},
        status: 401,
        name: 'ErroDaApi',
      }),
    )

    const { montada } = await montar(LoginView, '/entrar')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(montada.text()).not.toContain('sessão expirou')
  })

  it('leva para recuperação de senha e para o cadastro', async () => {
    const { montada } = await montar(LoginView, '/entrar')
    const enderecos = montada.findAll('a').map((a) => a.attributes('href'))

    expect(enderecos).toContain('/recuperar-senha')
    expect(enderecos).toContain('/criar-conta')
  })
})

describe('CadastroView', () => {
  it('cria a conta e termina em instrução, não em login', async () => {
    // A conta nasce desativada: só funciona depois de confirmar o e-mail.
    vi.mocked(servico.cadastrar).mockResolvedValue()
    const { montada } = await montar(CadastroView, '/criar-conta')

    await preencher(montada, 'Nome', 'Ana')
    await preencher(montada, 'E-mail', 'ana@example.com')
    await preencher(montada, 'Senha', 'Senha-Forte')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servico.cadastrar).toHaveBeenCalledWith({
      nome: 'Ana',
      email: 'ana@example.com',
      password: 'Senha-Forte',
    })
    expect(montada.text()).toContain('Confirme seu e-mail')
    expect(montada.text()).toContain('ana@example.com')
  })

  it('mostra a recusa do backend no campo certo', async () => {
    vi.mocked(servico.cadastrar).mockRejectedValue(
      erroDeApi(400, { email: ['E-mail já cadastrado.'] }),
    )
    const { montada } = await montar(CadastroView, '/criar-conta')

    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(montada.text()).toContain('E-mail já cadastrado.')
    expect(montada.text()).not.toContain('Confirme seu e-mail')
  })
})

describe('AtivarContaView', () => {
  it('confirma sozinha ao abrir, porque a escolha já foi clicar no link', async () => {
    vi.mocked(servico.ativarConta).mockResolvedValue()

    const { montada } = await montar(AtivarContaView, '/ativar/Mg/abc-123')

    expect(servico.ativarConta).toHaveBeenCalledWith({ uid: 'Mg', token: 'abc-123' })
    expect(montada.text()).toContain('Conta confirmada')
  })

  it('mostra a recusa do link e aponta as duas saídas', async () => {
    vi.mocked(servico.ativarConta).mockRejectedValue(
      erroDeApi(400, { token: ['Link inválido ou expirado.'] }),
    )

    const { montada } = await montar(AtivarContaView, '/ativar/Mg/velho')

    expect(montada.text()).toContain('Link inválido ou expirado.')
    expect(montada.text()).toContain('entre normalmente')
    expect(montada.text()).toContain('refaça o cadastro')
  })
})

describe('RecuperarSenhaView', () => {
  it('não confirma que a conta existe', async () => {
    // O backend responde igual exista ou não; a tela mantém esse silêncio.
    vi.mocked(servico.pedirRecuperacao).mockResolvedValue()
    const { montada } = await montar(RecuperarSenhaView, '/recuperar-senha')

    await preencher(montada, 'E-mail', 'quem-sabe@example.com')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servico.pedirRecuperacao).toHaveBeenCalledWith('quem-sabe@example.com')
    expect(montada.text()).toContain('Se houver uma conta ativa')
  })
})

describe('RedefinirSenhaView', () => {
  it('manda a nova senha com o par do link', async () => {
    vi.mocked(servico.redefinirSenha).mockResolvedValue()
    const { montada } = await montar(RedefinirSenhaView, '/redefinir-senha/Mg/abc-123')

    await preencher(montada, 'Nova senha', 'Senha-Nova-2026')
    await preencher(montada, 'Repita', 'Senha-Nova-2026')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servico.redefinirSenha).toHaveBeenCalledWith(
      { uid: 'Mg', token: 'abc-123' },
      'Senha-Nova-2026',
    )
    expect(montada.text()).toContain('Senha alterada')
  })

  it('barra o envio quando as duas senhas não batem', async () => {
    const { montada } = await montar(RedefinirSenhaView, '/redefinir-senha/Mg/abc-123')

    await preencher(montada, 'Nova senha', 'uma-senha')
    await preencher(montada, 'Repita', 'outra-senha')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servico.redefinirSenha).not.toHaveBeenCalled()
    expect(montada.text()).toContain('precisam ser iguais')
  })

  it('mostra a recusa do token, que não tem campo na tela', async () => {
    vi.mocked(servico.redefinirSenha).mockRejectedValue(
      erroDeApi(400, { token: ['Link inválido ou expirado.'] }),
    )
    const { montada } = await montar(RedefinirSenhaView, '/redefinir-senha/Mg/velho')

    await preencher(montada, 'Nova senha', 'Senha-Nova-2026')
    await preencher(montada, 'Repita', 'Senha-Nova-2026')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(montada.text()).toContain('Link inválido ou expirado.')
  })
})

describe('AlterarSenhaView', () => {
  it('derruba a sessão local, porque o backend derrubou os tokens', async () => {
    vi.mocked(servico.alterarSenha).mockResolvedValue()
    const sessao = useSessao()
    sessao.token = 'token'

    const { montada } = await montar(AlterarSenhaView, '/conta/senha')

    await preencher(montada, 'Senha atual', 'antiga')
    await preencher(montada, 'Nova senha', 'Senha-Nova-2026')
    await preencher(montada, 'Repita', 'Senha-Nova-2026')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servico.alterarSenha).toHaveBeenCalledWith('antiga', 'Senha-Nova-2026')
    expect(sessao.autenticado).toBe(false)
    expect(montada.text()).toContain('encerra as sessões abertas')
  })

  it('mostra a recusa da senha atual', async () => {
    vi.mocked(servico.alterarSenha).mockRejectedValue(
      erroDeApi(400, { senha_atual: ['Senha atual incorreta.'] }),
    )
    const { montada } = await montar(AlterarSenhaView, '/conta/senha')

    await preencher(montada, 'Senha atual', 'errada')
    await preencher(montada, 'Nova senha', 'Senha-Nova-2026')
    await preencher(montada, 'Repita', 'Senha-Nova-2026')
    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(montada.text()).toContain('Senha atual incorreta.')
  })

  it('aparece sob o cabeçalho da conta, e não como página solta', async () => {
    const { montada } = await montar(AlterarSenhaView, '/conta/senha')

    expect(montada.text()).toContain('Minha conta')
    expect(montada.findAll('a').map((a) => a.attributes('href'))).toContain('/conta/enderecos')
  })
})
