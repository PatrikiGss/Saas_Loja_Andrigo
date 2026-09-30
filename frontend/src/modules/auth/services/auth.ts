/**
 * Serviço de autenticação e conta.
 *
 * O refresh token não aparece em nenhuma função daqui: ele entra e sai pelo
 * cookie httpOnly que o backend grava, e o navegador o devolve sozinho nas
 * rotas `/api/auth/`.
 */
import { objetoCom } from '@/services/conferencia'
import { comoCredenciaisRecusadas } from '@/services/erros'
import { http } from '@/services/http'
import type { Esquema } from '@/types/api'
import type { Acesso, Credenciais, CredenciaisDoLink, DadosDeCadastro, Perfil } from '../types'

/**
 * Rotas em que um 401 é resposta legítima, e não sessão vencida.
 *
 * Sem isto, senha errada no login dispararia uma tentativa de renovação, e a
 * falha do refresh é que apareceria na tela no lugar de 'senha incorreta'.
 */
const SEM_RENOVACAO = { semRenovacao: true } as const

/**
 * `POST /api/auth/login/` — público. O refresh volta no cookie.
 *
 * O 401 daqui não é sessão vencida: é credencial recusada, e a mensagem é
 * traduzida para dizer isso.
 */
export async function autenticar(credenciais: Credenciais): Promise<Acesso> {
  try {
    const { data } = await http.post<Acesso>('/auth/login/', credenciais, SEM_RENOVACAO)
    // Sem `access` não há sessão: guardar `undefined` faria a aplicação achar
    // que entrou e falhar na primeira requisição autenticada.
    return objetoCom<Acesso>(data, ['access'])
  } catch (falha) {
    throw comoCredenciaisRecusadas(falha)
  }
}

/** `POST /api/auth/refresh/` — lê o cookie, devolve access novo. */
export async function renovarAcesso(): Promise<Acesso> {
  const { data } = await http.post<Acesso>('/auth/refresh/', {}, SEM_RENOVACAO)
  return objetoCom<Acesso>(data, ['access'])
}

/** `POST /api/auth/logout/` — derruba o refresh e apaga o cookie. */
export async function encerrarSessao(): Promise<void> {
  await http.post('/auth/logout/', {}, SEM_RENOVACAO)
}

/** `POST /api/auth/cadastro/` — público. A conta nasce desativada. */
export async function cadastrar(dados: DadosDeCadastro): Promise<void> {
  await http.post('/auth/cadastro/', dados, SEM_RENOVACAO)
}

/** `POST /api/auth/ativar/` — confirma o e-mail pelo link recebido. */
export async function ativarConta(credenciais: CredenciaisDoLink): Promise<void> {
  await http.post('/auth/ativar/', credenciais, SEM_RENOVACAO)
}

/** `POST /api/auth/senha/recuperar/` — responde igual exista ou não a conta. */
export async function pedirRecuperacao(email: string): Promise<void> {
  await http.post(
    '/auth/senha/recuperar/',
    { email } satisfies Esquema<'RecuperarSenhaRequest'>,
    SEM_RENOVACAO,
  )
}

/** `POST /api/auth/senha/redefinir/` — nova senha a partir do link. */
export async function redefinirSenha(
  credenciais: CredenciaisDoLink,
  nova_senha: string,
): Promise<void> {
  await http.post(
    '/auth/senha/redefinir/',
    { ...credenciais, nova_senha } satisfies Esquema<'RedefinirSenhaRequest'>,
    SEM_RENOVACAO,
  )
}

/**
 * `POST /api/auth/senha/` — troca a senha da própria conta.
 *
 * O backend derruba os tokens em circulação depois da troca, então quem
 * chamar isto perde a sessão de propósito e precisa entrar de novo.
 */
export async function alterarSenha(senha_atual: string, nova_senha: string): Promise<void> {
  await http.post('/auth/senha/', {
    senha_atual,
    nova_senha,
  } satisfies Esquema<'AlterarSenhaRequest'>)
}

/** `GET /api/perfil/` — conta autenticada. É onde o nível de acesso aparece. */
export async function buscarPerfil(): Promise<Perfil> {
  const { data } = await http.get<Perfil>('/perfil/')
  // `nivel` decide o que a interface oferece; ausente, tudo pareceria cliente.
  return objetoCom<Perfil>(data, ['email', 'nivel'])
}
