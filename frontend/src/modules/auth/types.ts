/** Formas de conta e autenticação que o backend usa. */

/** `Nivel.choices` do backend. O frontend só reflete: quem decide é a API. */
export type Nivel = 'usuario' | 'admin'

/** Resposta de `GET /api/perfil/` e de `PUT/PATCH` no mesmo endereço. */
export interface Perfil {
  email: string
  nome: string
  sobrenome: string
  telefone: string
  nivel: Nivel
}

export interface Credenciais {
  email: string
  password: string
}

export interface DadosDeCadastro extends Credenciais {
  nome: string
}

/**
 * Corpo do login e do refresh.
 *
 * Só o access token: o refresh fica no cookie httpOnly e nunca chega ao
 * JavaScript, que é o motivo de ele não aparecer neste tipo.
 */
export interface Acesso {
  access: string
}

/** Par que identifica a conta nos links de e-mail. */
export interface CredenciaisDoLink {
  uid: string
  token: string
}
