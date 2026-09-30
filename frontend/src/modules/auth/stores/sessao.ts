/**
 * Sessão da pessoa autenticada.
 *
 * O access token vive só aqui, em memória: recarregar a página o perde de
 * propósito. Quem sobrevive ao recarregamento é o cookie httpOnly do refresh,
 * que o JavaScript não lê — então `restaurar()` pede um access novo ao
 * backend em vez de ler token guardado em lugar nenhum.
 *
 * O nível de acesso é espelho do que a API respondeu, e serve só para a
 * interface não oferecer o que a conta não pode fazer. Quem autoriza é o
 * backend, a cada requisição.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { autenticar, buscarPerfil, encerrarSessao, renovarAcesso } from '../services/auth'
import type { Credenciais, Perfil } from '../types'

export const useSessao = defineStore('sessao', () => {
  const token = ref<string | null>(null)
  const usuario = ref<Perfil | null>(null)

  /** Restauração da partida, para os guards esperarem antes de decidir. */
  let restauracao: Promise<void> | null = null

  const autenticado = computed(() => token.value !== null)
  const ehAdmin = computed(() => usuario.value?.nivel === 'admin')

  /** Como chamar a pessoa no cabeçalho. Nem toda conta preencheu o nome. */
  const nomeExibido = computed(() => {
    const perfil = usuario.value
    if (!perfil) {
      return ''
    }
    return [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ') || perfil.email
  })

  function limpar(): void {
    token.value = null
    usuario.value = null
  }

  /**
   * Guarda o perfil que o servidor acabou de devolver.
   *
   * Usado depois de editar a conta, para o nome no cabeçalho não ficar
   * mostrando o que foi trocado há dois segundos.
   */
  function guardarPerfil(perfil: Perfil): void {
    usuario.value = perfil
  }

  async function entrar(credenciais: Credenciais): Promise<void> {
    const { access } = await autenticar(credenciais)
    token.value = access
    // O login devolve só o token; nível e nome vêm do perfil.
    usuario.value = await buscarPerfil()
  }

  /**
   * Troca o cookie do refresh por um access novo.
   *
   * Não busca o perfil aqui de propósito: esta função é chamada pelo
   * interceptador quando uma requisição toma 401, e uma segunda chamada à API
   * lá dentro poderia tomar 401 também e esperar por esta mesma renovação,
   * que ainda não terminou.
   */
  async function renovar(): Promise<string | null> {
    try {
      const { access } = await renovarAcesso()
      token.value = access
      return access
    } catch {
      limpar()
      return null
    }
  }

  /** Tenta retomar a sessão pelo cookie. Roda uma vez, na partida. */
  function restaurar(): Promise<void> {
    restauracao ??= (async () => {
      if (!(await renovar())) {
        return
      }
      try {
        usuario.value = await buscarPerfil()
      } catch {
        limpar()
      }
    })()
    return restauracao
  }

  /** Resolve quando a restauração inicial terminou. */
  function pronta(): Promise<void> {
    return restaurar()
  }

  /**
   * Encerra a sessão.
   *
   * Nunca lança: prender a pessoa na tela que ela pediu para deixar é pior do
   * que a falha em si. Se a chamada não chegou ao servidor, o refresh não foi
   * para a blacklist e o cookie continua de pé — a próxima visita vai
   * restaurar a sessão, e aí basta sair de novo com a rede funcionando.
   */
  async function sair(): Promise<void> {
    try {
      await encerrarSessao()
    } catch {
      // Sem tratamento: o estado local cai do mesmo jeito, logo abaixo.
    }
    limpar()
  }

  return {
    token,
    usuario,
    autenticado,
    ehAdmin,
    nomeExibido,
    entrar,
    renovar,
    restaurar,
    pronta,
    sair,
    limpar,
    guardarPerfil,
  }
})
