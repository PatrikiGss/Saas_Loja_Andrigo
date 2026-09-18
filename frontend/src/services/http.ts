/**
 * Instância HTTP única da aplicação.
 *
 * Todo serviço de domínio chama por aqui, então base da URL, tempo limite,
 * cabeçalho de autenticação, renovação de token e tradução de erro existem uma
 * vez só. Nenhum componente conversa com a API direto.
 *
 * A sessão não mora neste arquivo: ela é registrada pelo módulo de
 * autenticação. É o que mantém a camada HTTP sem saber como o token é
 * guardado, e o módulo de autenticação sem saber de interceptador.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { TEMPO_LIMITE_MS, URL_DA_API } from '@/app/config'
import { deErro } from './erros'

export const http = axios.create({
  baseURL: URL_DA_API,
  timeout: TEMPO_LIMITE_MS,
  headers: { 'Content-Type': 'application/json' },
  // O refresh token viaja em cookie httpOnly, e o navegador só o envia para
  // outra origem com isto ligado. O cookie tem caminho `/api/auth/`, então
  // ele não acompanha as chamadas de catálogo, carrinho ou pedido.
  withCredentials: true,
})

/** O que a camada HTTP precisa saber sobre a sessão — e nada além disso. */
export interface AdaptadorDeSessao {
  /** Token de acesso atual, ou nada se ninguém está autenticado. */
  tokenDeAcesso(): string | null
  /**
   * Tenta um token novo. Devolve nada quando a renovação não é possível.
   *
   * Contrato: quando resolve com um token, esse token já precisa estar
   * guardado na sessão, porque quem escreve o cabeçalho `Authorization` é
   * sempre o interceptador de requisição, lendo `tokenDeAcesso()`. É por isso
   * que a repetição abaixo não mexe no cabeçalho: um lugar só o define.
   */
  renovar(): Promise<string | null>
  /** Descarta a sessão: a renovação falhou e não há a quem voltar. */
  encerrar(): void
}

let sessao: AdaptadorDeSessao | null = null

/** Liga a sessão à camada HTTP. Chamado uma vez, na partida da aplicação. */
export function registrarSessao(adaptador: AdaptadorDeSessao): void {
  sessao = adaptador
}

/** Desliga a sessão. Existe para os testes não vazarem estado entre si. */
export function esquecerSessao(): void {
  sessao = null
  renovacaoEmCurso = null
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Desliga a renovação automática nesta requisição.
     *
     * Vale para as rotas em que 401 é resposta legítima e não sessão vencida:
     * o login com senha errada e o próprio refresh, que entraria em laço.
     */
    semRenovacao?: boolean
  }
}

interface RequisicaoInterna extends InternalAxiosRequestConfig {
  /** Marca a requisição que já foi repetida uma vez, para não repetir sempre. */
  jaRenovou?: boolean
}

http.interceptors.request.use((requisicao) => {
  const token = sessao?.tokenDeAcesso()
  if (token) {
    requisicao.headers.Authorization = `Bearer ${token}`
  }
  return requisicao
})

/**
 * Renovação em andamento, compartilhada.
 *
 * Com o access token durando 15 minutos, é comum várias requisições
 * receberem 401 ao mesmo tempo. Sem isto, cada uma pediria um refresh, e como
 * o backend rotaciona o refresh token a cada uso, a segunda chamada chegaria
 * com um token já na blacklist e derrubaria a sessão de quem estava logado.
 */
let renovacaoEmCurso: Promise<string | null> | null = null

function renovarUmaVez(adaptador: AdaptadorDeSessao): Promise<string | null> {
  renovacaoEmCurso ??= adaptador.renovar().finally(() => {
    renovacaoEmCurso = null
  })
  return renovacaoEmCurso
}

http.interceptors.response.use(
  (resposta) => resposta,
  async (falha: AxiosError) => {
    const requisicao = falha.config as RequisicaoInterna | undefined
    const deveRenovar =
      falha.response?.status === 401 &&
      sessao !== null &&
      requisicao !== undefined &&
      !requisicao.jaRenovou &&
      !requisicao.semRenovacao

    if (deveRenovar) {
      const adaptador = sessao as AdaptadorDeSessao
      requisicao.jaRenovou = true

      const token = await renovarUmaVez(adaptador)
      if (token) {
        // Sem tocar no cabeçalho: ao repetir, o interceptador de requisição
        // roda de novo e põe o token que a sessão já guardou.
        return http.request(requisicao)
      }

      adaptador.encerrar()
    }

    return Promise.reject(deErro(falha))
  },
)
