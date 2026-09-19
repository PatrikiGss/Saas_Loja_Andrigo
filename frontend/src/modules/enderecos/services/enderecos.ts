/**
 * Serviço de endereços e consulta de CEP.
 *
 * A consulta de CEP passa pelo backend, e não pelo ViaCEP direto: é ele que
 * guarda o provedor, o tempo limite e o freio por minuto. Trocar de provedor
 * não deveria tocar em frontend nenhum.
 */
import { http } from '@/services/http'
import { coletarTudo } from '@/services/paginacao'
import { apenasDigitos } from '@/utils/formato'
import type { DadosDeEndereco, Endereco, EnderecoConsultado } from '../types'

/** `GET /api/enderecos/` — só os da própria conta, paginados de 20 em 20. */
export function listarEnderecos(): Promise<Endereco[]> {
  return coletarTudo<Endereco>('/enderecos/')
}

/** `POST /api/enderecos/` — o dono vem do token. */
export async function criarEndereco(dados: DadosDeEndereco): Promise<Endereco> {
  const { data } = await http.post<Endereco>('/enderecos/', dados)
  return data
}

/** `PATCH /api/enderecos/<id>/` — endereço de outra conta responde 404. */
export async function atualizarEndereco(
  id: number,
  dados: Partial<DadosDeEndereco>,
): Promise<Endereco> {
  const { data } = await http.patch<Endereco>(`/enderecos/${id}/`, dados)
  return data
}

/** `DELETE /api/enderecos/<id>/`. */
export async function removerEndereco(id: number): Promise<void> {
  await http.delete(`/enderecos/${id}/`)
}

/**
 * `GET /api/cep/<cep>/` — autenticado, com limite de 30 por minuto.
 *
 * A pontuação sai antes de sair daqui: o backend espera oito dígitos.
 */
export async function consultarCep(valor: string): Promise<EnderecoConsultado> {
  const { data } = await http.get<EnderecoConsultado>(`/cep/${apenasDigitos(valor)}/`)
  return data
}
