/** Endereços do cliente, servidos pela app `painel`. Gerados do esquema. */
import type { Esquema } from '@/types/api'

/** Resposta de `/api/enderecos/`. O CEP tem oito dígitos, sem pontuação. */
export type Endereco = Esquema<'Endereco'>

/** Campos que o cliente manda. O dono vem do token, nunca do payload. */
export type DadosDeEndereco = Esquema<'EnderecoRequest'>

/** Resposta de `GET /api/cep/<cep>/`, para preencher o formulário. */
export type EnderecoConsultado = Esquema<'EnderecoConsultado'>

/** Sigla de unidade da federação que o backend aceita. */
export type SiglaDaUF = Esquema<'UFEnum'>
