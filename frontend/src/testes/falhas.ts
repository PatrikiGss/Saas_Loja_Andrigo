/**
 * Falhas do axios como a camada HTTP as recebe, para os testes que trocam o
 * serviço por dublê. Os componentes nunca olham status: o que eles veem é o
 * `ErroDaApi` em que `deErro` transforma isto.
 */
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'

/** O servidor respondeu com erro: status e corpo, como o DRF devolve. */
export function falhaComResposta(status: number, corpo: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const resposta = { status, data: corpo, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('falhou', String(status), config, {}, resposta)
}

/** Nem chegou resposta: rede fora, ou tempo esgotado com `ECONNABORTED`. */
export function falhaSemResposta(codigo?: string): AxiosError {
  return new AxiosError('falhou', codigo, { headers: new AxiosHeaders() }, {})
}
