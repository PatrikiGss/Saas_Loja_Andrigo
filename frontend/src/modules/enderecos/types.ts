/** Endereços do cliente, servidos pela app `painel`. */

/** Resposta de `/api/enderecos/`. */
export interface Endereco {
  id: number
  apelido: string
  /** Oito dígitos, sem pontuação: é assim que o backend valida e guarda. */
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

/** Campos que o cliente manda. O dono vem do token, nunca do payload. */
export type DadosDeEndereco = Omit<Endereco, 'id'>

/** Resposta de `GET /api/cep/<cep>/`, para preencher o formulário. */
export interface EnderecoConsultado {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}
