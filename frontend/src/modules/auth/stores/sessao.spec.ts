import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErroDaApi, type TipoDeErro } from '@/services/erros'
import * as servico from '../services/auth'
import type { Perfil } from '../types'
import { useSessao } from './sessao'

vi.mock('../services/auth')

const PERFIL: Perfil = {
  email: 'cliente@example.com',
  nome: 'Ana',
  sobrenome: 'Lima',
  telefone: '',
  nivel: 'usuario',
}

function erro(tipo: TipoDeErro = 'nao_autenticado'): ErroDaApi {
  return new ErroDaApi(tipo, 'falhou', 401, {})
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.autenticar).mockReset()
  vi.mocked(servico.buscarPerfil).mockReset()
  vi.mocked(servico.renovarAcesso).mockReset()
  vi.mocked(servico.encerrarSessao).mockReset()
})

describe('sessão', () => {
  it('nasce sem ninguém autenticado', () => {
    const sessao = useSessao()

    expect(sessao.autenticado).toBe(false)
    expect(sessao.usuario).toBeNull()
    expect(sessao.ehAdmin).toBe(false)
  })

  it('entra e busca o perfil, porque o login só devolve o token', async () => {
    vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
    const sessao = useSessao()

    await sessao.entrar({ email: PERFIL.email, password: 'x' })

    expect(sessao.autenticado).toBe(true)
    expect(sessao.usuario).toEqual(PERFIL)
    expect(servico.buscarPerfil).toHaveBeenCalledTimes(1)
  })

  it('não guarda refresh token em lugar nenhum', async () => {
    vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
    const sessao = useSessao()

    await sessao.entrar({ email: PERFIL.email, password: 'x' })

    // O refresh vive no cookie httpOnly; se um dia encostar aqui, este teste cai.
    expect(JSON.stringify(sessao.$state)).not.toContain('refresh')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('reflete o nível que a API respondeu, sem decidir nada', async () => {
    vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue({ ...PERFIL, nivel: 'admin' })
    const sessao = useSessao()

    await sessao.entrar({ email: PERFIL.email, password: 'x' })

    expect(sessao.ehAdmin).toBe(true)
  })

  it('renova o access sem buscar o perfil de novo', async () => {
    vi.mocked(servico.renovarAcesso).mockResolvedValue({ access: 'token-novo' })
    const sessao = useSessao()

    const token = await sessao.renovar()

    expect(token).toBe('token-novo')
    expect(sessao.token).toBe('token-novo')
    // Buscar o perfil aqui poderia tomar 401 e esperar por esta mesma
    // renovação, que ainda não terminou.
    expect(servico.buscarPerfil).not.toHaveBeenCalled()
  })

  it('limpa a sessão quando a renovação falha', async () => {
    vi.mocked(servico.renovarAcesso).mockRejectedValue(erro())
    const sessao = useSessao()

    const token = await sessao.renovar()

    expect(token).toBeNull()
    expect(sessao.autenticado).toBe(false)
  })

  it('retoma a sessão pelo cookie ao abrir a página', async () => {
    vi.mocked(servico.renovarAcesso).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
    const sessao = useSessao()

    await sessao.restaurar()

    expect(sessao.autenticado).toBe(true)
    expect(sessao.nomeExibido).toBe('Ana Lima')
  })

  it('sem cookie válido, a página abre deslogada e sem erro na tela', async () => {
    vi.mocked(servico.renovarAcesso).mockRejectedValue(erro())
    const sessao = useSessao()

    await expect(sessao.restaurar()).resolves.toBeUndefined()

    expect(sessao.autenticado).toBe(false)
  })

  it('restaura uma vez só, mesmo com vários guards esperando', async () => {
    vi.mocked(servico.renovarAcesso).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
    const sessao = useSessao()

    await Promise.all([sessao.pronta(), sessao.pronta(), sessao.restaurar()])

    expect(servico.renovarAcesso).toHaveBeenCalledTimes(1)
  })

  it('sai e não lança quando o logout falha, para a navegação seguir', async () => {
    vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
    vi.mocked(servico.encerrarSessao).mockRejectedValue(erro('rede'))
    const sessao = useSessao()
    await sessao.entrar({ email: PERFIL.email, password: 'x' })

    await expect(sessao.sair()).resolves.toBeUndefined()

    expect(sessao.autenticado).toBe(false)
    expect(sessao.usuario).toBeNull()
  })

  it('sai pelo caminho normal derrubando o refresh no servidor', async () => {
    vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue(PERFIL)
    vi.mocked(servico.encerrarSessao).mockResolvedValue()
    const sessao = useSessao()
    await sessao.entrar({ email: PERFIL.email, password: 'x' })

    await sessao.sair()

    expect(servico.encerrarSessao).toHaveBeenCalledTimes(1)
    expect(sessao.autenticado).toBe(false)
  })

  it('usa o e-mail quando a conta não preencheu o nome', async () => {
    vi.mocked(servico.autenticar).mockResolvedValue({ access: 'token' })
    vi.mocked(servico.buscarPerfil).mockResolvedValue({ ...PERFIL, nome: '', sobrenome: '' })
    const sessao = useSessao()

    await sessao.entrar({ email: PERFIL.email, password: 'x' })

    expect(sessao.nomeExibido).toBe('cliente@example.com')
  })
})
