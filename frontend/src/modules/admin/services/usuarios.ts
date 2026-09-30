/**
 * Administração de contas.
 *
 * Não existe exclusão: desativar basta e é reversível. O nível tem endpoint
 * próprio, separado do PATCH, porque mudar privilégio é operação à parte — e
 * o backend recusa mexer na própria conta e em superusuário.
 */
import { http } from '@/services/http'
import type { Nivel } from '@/modules/auth/types'
import { coletarTudo } from '@/services/paginacao'
import type { Esquema } from '@/types/api'
import type { UsuarioAdmin } from '../types'

export function listarUsuarios(): Promise<UsuarioAdmin[]> {
  return coletarTudo<UsuarioAdmin>('/usuarios/')
}

/** `PATCH /api/usuarios/<id>/` — `ativo` é o único campo gravável. */
export async function definirAtivo(id: number, ativo: boolean): Promise<UsuarioAdmin> {
  const { data } = await http.patch<UsuarioAdmin>(`/usuarios/${id}/`, {
    ativo,
  } satisfies Esquema<'PatchedUsuarioAdminRequest'>)
  return data
}

/** `POST /api/usuarios/<id>/nivel/` — promove ou rebaixa. */
export async function definirNivel(id: number, nivel: Nivel): Promise<Nivel> {
  const { data } = await http.post<Esquema<'AlteracaoNivel'>>(`/usuarios/${id}/nivel/`, {
    nivel,
  } satisfies Esquema<'AlteracaoNivelRequest'>)
  return data.nivel
}
