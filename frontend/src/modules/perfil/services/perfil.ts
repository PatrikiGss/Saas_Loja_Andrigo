/**
 * Serviço do perfil da conta autenticada.
 *
 * Não existe id na URL: o objeto vem do token, então não há perfil de outra
 * pessoa para pedir. E-mail e nível são somente leitura no serializer — o
 * e-mail identifica a conta no login, e o nível vive em `is_staff`, fora do
 * alcance de qualquer payload.
 */
import { http } from '@/services/http'
import type { Perfil } from '@/modules/auth/types'
import type { Esquema } from '@/types/api'

/**
 * Campos que o cliente pode mudar no próprio perfil — todos, já que o
 * formulário manda o perfil inteiro. Campo gravável novo no backend aparece
 * aqui como obrigatório, e o formulário deixa de compilar até tratá-lo.
 */
export type DadosDoPerfil = Required<Esquema<'PatchedPerfilRequest'>>

/** `GET /api/perfil/`. */
export async function buscarPerfil(): Promise<Perfil> {
  const { data } = await http.get<Perfil>('/perfil/')
  return data
}

/** `PATCH /api/perfil/` — só os campos editáveis chegam ao servidor. */
export async function atualizarPerfil(dados: DadosDoPerfil): Promise<Perfil> {
  const { data } = await http.patch<Perfil>('/perfil/', dados)
  return data
}
