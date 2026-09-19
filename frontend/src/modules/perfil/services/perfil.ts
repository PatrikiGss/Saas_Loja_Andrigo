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

/** Campos que o cliente pode mudar no próprio perfil. */
export interface DadosDoPerfil {
  nome: string
  sobrenome: string
  telefone: string
}

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
