/**
 * As seis telas de conta, num arquivo só.
 *
 * Elas dividem a mesma montagem — roteador de memória, Pinia limpo e o
 * serviço de autenticação substituído — e separá-las em seis arquivos
 * repetiria esse preparo seis vezes sem acrescentar nada.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Component } from 'vue'

import { useSessao } from '../stores/sessao'
import * as servico from '../services/auth'
import AlterarSenhaView from './AlterarSenhaView.vue'
import AtivarContaView from './AtivarContaView.vue'
import CadastroView from './CadastroView.vue'
import LoginView from './LoginView.vue'
import RecuperarSenhaView from './RecuperarSenhaView.vue'
import RedefinirSenhaView from './RedefinirSenhaView.vue'
import { falhaComResposta } from '../../../testes/falhas'
import { umPerfil } from '../../../testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('../services/auth')

const PERFIL = umPerfil({ email: 'ana@example.com' })

const ROTAS = {
  inicio: '/',
  entrar: '/entrar',
  'criar-conta': '/criar-conta',
  'recuperar-senha': '/recuperar-senha',
  'ativar-conta': '/ativar/:uid/:token',
  'redefinir-senha': '/redefinir-senha/:uid/:token',
  conta: '/conta',
  'conta-enderecos': '/conta/enderecos',
  'alterar-senha': '/conta/senha',
  pedidos: '/pedidos',
}

function montar(componente: Component, caminho: string) {
  return montarNaRota(componente, caminho, ROTAS)
}

function campoDe(tela: ReturnType<typeof mount>, rotulo: string) {
  return tela.findAll('.campo').find((bloco) => bloco.text().startsWith(rotulo))!
}

async function preencher(tela: ReturnType<typeof mount>, rotulo: string, valor: string) {
  await campoDe(tela, rotulo).get('input').setValue(valor)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
  vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
})

describe('LoginView', () => {
  it('entra e volta para a raiz quando não havia destino', async () => {
    const { tela, router } = await montar(LoginView, '/entrar')

    await preencher(tela, 'E-mail', 'ana@example.com')
    await preencher(tela, 'Senha', 'Senha-Forte')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.autenticar).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'Senha-Forte',
    })
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('volta para onde a pessoa queria ir', async () => {
    const { tela, router } = await montar(LoginView, '/entrar?destino=/pedidos')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/pedidos')
  })

  it('recusa destino que aponta para fora', async () => {
    const { tela, router } = await montar(LoginView, '/entrar?destino=//exemplo-hostil.test')

    await tela.get('form').trigger('submit')
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

    const { tela } = await montar(LoginView, '/entrar')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).not.toContain('sessão expirou')
  })

  it('leva para recuperação de senha e para o cadastro', async () => {
    const { tela } = await montar(LoginView, '/entrar')
    const enderecos = tela.findAll('a').map((a) => a.attributes('href'))

    expect(enderecos).toContain('/recuperar-senha')
    expect(enderecos).toContain('/criar-conta')
  })
})

describe('CadastroView', () => {
  it('cria a conta e termina em instrução, não em login', async () => {
    // A conta nasce desativada: só funciona depois de confirmar o e-mail.
    vi.mocked(servico.cadastrar).mockResolvedValue()
    const { tela } = await montar(CadastroView, '/criar-conta')

    await preencher(tela, 'Nome', 'Ana')
    await preencher(tela, 'E-mail', 'ana@example.com')
    await preencher(tela, 'Senha', 'Senha-Forte')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.cadastrar).toHaveBeenCalledWith({
      nome: 'Ana',
      email: 'ana@example.com',
      password: 'Senha-Forte',
    })
    expect(tela.text()).toContain('Confirme seu e-mail')
    expect(tela.text()).toContain('ana@example.com')
  })

  it('mostra a recusa do backend no campo certo', async () => {
    vi.mocked(servico.cadastrar).mockRejectedValue(
      falhaComResposta(400, { email: ['E-mail já cadastrado.'] }),
    )
    const { tela } = await montar(CadastroView, '/criar-conta')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).toContain('E-mail já cadastrado.')
    expect(tela.text()).not.toContain('Confirme seu e-mail')
  })
})

describe('AtivarContaView', () => {
  it('confirma sozinha ao abrir, porque a escolha já foi clicar no link', async () => {
    vi.mocked(servico.ativarConta).mockResolvedValue()

    const { tela } = await montar(AtivarContaView, '/ativar/Mg/abc-123')

    expect(servico.ativarConta).toHaveBeenCalledWith({ uid: 'Mg', token: 'abc-123' })
    expect(tela.text()).toContain('Conta confirmada')
  })

  it('mostra a recusa do link e aponta as duas saídas', async () => {
    vi.mocked(servico.ativarConta).mockRejectedValue(
      falhaComResposta(400, { token: ['Link inválido ou expirado.'] }),
    )

    const { tela } = await montar(AtivarContaView, '/ativar/Mg/velho')

    expect(tela.text()).toContain('Link inválido ou expirado.')
    expect(tela.text()).toContain('entre normalmente')
    expect(tela.text()).toContain('refaça o cadastro')
  })
})

describe('RecuperarSenhaView', () => {
  it('não confirma que a conta existe', async () => {
    // O backend responde igual exista ou não; a tela mantém esse silêncio.
    vi.mocked(servico.pedirRecuperacao).mockResolvedValue()
    const { tela } = await montar(RecuperarSenhaView, '/recuperar-senha')

    await preencher(tela, 'E-mail', 'quem-sabe@example.com')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.pedirRecuperacao).toHaveBeenCalledWith('quem-sabe@example.com')
    expect(tela.text()).toContain('Se houver uma conta ativa')
  })
})

describe('RedefinirSenhaView', () => {
  it('manda a nova senha com o par do link', async () => {
    vi.mocked(servico.redefinirSenha).mockResolvedValue()
    const { tela } = await montar(RedefinirSenhaView, '/redefinir-senha/Mg/abc-123')

    await preencher(tela, 'Nova senha', 'Senha-Nova-2026')
    await preencher(tela, 'Repita', 'Senha-Nova-2026')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.redefinirSenha).toHaveBeenCalledWith(
      { uid: 'Mg', token: 'abc-123' },
      'Senha-Nova-2026',
    )
    expect(tela.text()).toContain('Senha alterada')
  })

  it('barra o envio quando as duas senhas não batem', async () => {
    const { tela } = await montar(RedefinirSenhaView, '/redefinir-senha/Mg/abc-123')

    await preencher(tela, 'Nova senha', 'uma-senha')
    await preencher(tela, 'Repita', 'outra-senha')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.redefinirSenha).not.toHaveBeenCalled()
    expect(tela.text()).toContain('precisam ser iguais')
  })

  it('mostra a recusa do token, que não tem campo na tela', async () => {
    vi.mocked(servico.redefinirSenha).mockRejectedValue(
      falhaComResposta(400, { token: ['Link inválido ou expirado.'] }),
    )
    const { tela } = await montar(RedefinirSenhaView, '/redefinir-senha/Mg/velho')

    await preencher(tela, 'Nova senha', 'Senha-Nova-2026')
    await preencher(tela, 'Repita', 'Senha-Nova-2026')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).toContain('Link inválido ou expirado.')
  })
})

describe('AlterarSenhaView', () => {
  it('derruba a sessão local, porque o backend derrubou os tokens', async () => {
    vi.mocked(servico.alterarSenha).mockResolvedValue()
    const sessao = useSessao()
    sessao.token = 'token'

    const { tela } = await montar(AlterarSenhaView, '/conta/senha')

    await preencher(tela, 'Senha atual', 'antiga')
    await preencher(tela, 'Nova senha', 'Senha-Nova-2026')
    await preencher(tela, 'Repita', 'Senha-Nova-2026')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.alterarSenha).toHaveBeenCalledWith('antiga', 'Senha-Nova-2026')
    expect(sessao.autenticado).toBe(false)
    expect(tela.text()).toContain('encerra as sessões abertas')
  })

  it('mostra a recusa da senha atual', async () => {
    vi.mocked(servico.alterarSenha).mockRejectedValue(
      falhaComResposta(400, { senha_atual: ['Senha atual incorreta.'] }),
    )
    const { tela } = await montar(AlterarSenhaView, '/conta/senha')

    await preencher(tela, 'Senha atual', 'errada')
    await preencher(tela, 'Nova senha', 'Senha-Nova-2026')
    await preencher(tela, 'Repita', 'Senha-Nova-2026')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).toContain('Senha atual incorreta.')
  })

  it('aparece sob o cabeçalho da conta, e não como página solta', async () => {
    const { tela } = await montar(AlterarSenhaView, '/conta/senha')

    expect(tela.text()).toContain('Minha conta')
    expect(tela.findAll('a').map((a) => a.attributes('href'))).toContain('/conta/enderecos')
  })
})
