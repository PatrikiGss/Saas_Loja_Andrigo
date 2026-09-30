/** Formas de conta e autenticação, geradas do esquema do backend. */
import type { Esquema } from '@/types/api'

/** O frontend só reflete o nível: quem decide é a API. */
export type Nivel = Esquema<'NivelEnum'>

/** Resposta de `GET /api/perfil/` e de `PUT/PATCH` no mesmo endereço. */
export type Perfil = Esquema<'Perfil'>

export type Credenciais = Esquema<'LoginRequest'>

export type DadosDeCadastro = Esquema<'CadastroRequest'>

/**
 * Corpo do login e do refresh.
 *
 * Só o access token: o refresh fica no cookie httpOnly e nunca chega ao
 * JavaScript, que é o motivo de ele não aparecer neste tipo.
 */
export type Acesso = Esquema<'Acesso'>

/** Par que identifica a conta nos links de e-mail. */
export type CredenciaisDoLink = Esquema<'AtivarContaRequest'>
