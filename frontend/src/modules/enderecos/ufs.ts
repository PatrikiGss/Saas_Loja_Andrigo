/**
 * Unidades da federação, para o seletor do formulário de endereço.
 *
 * As siglas vêm do esquema (`painel.models.UF`); os nomes ficam aqui, porque
 * o esquema traz o valor das opções e não o rótulo. O mapa é indexado pela
 * sigla gerada, então UF nova no backend quebra a compilação até ganhar nome,
 * e UF removida lá também.
 *
 * Quem valida o destino continua sendo o backend, que recusa UF fora das
 * opções e estado sem cobertura de frete. Some junto com o resto do formato
 * brasileiro quando o país de operação for definido.
 */
import type { SiglaDaUF } from './types'

export interface UnidadeFederativa {
  sigla: SiglaDaUF
  nome: string
}

const NOME_DA_UF: Record<SiglaDaUF, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AM: 'Amazonas',
  AP: 'Amapá',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  PA: 'Pará',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  PI: 'Piauí',
  PR: 'Paraná',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RO: 'Rondônia',
  RR: 'Roraima',
  RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  SE: 'Sergipe',
  SP: 'São Paulo',
  TO: 'Tocantins',
}

/** Na ordem do mapa, que é a alfabética da sigla. */
export const UFS: readonly UnidadeFederativa[] = Object.entries(NOME_DA_UF).map(
  ([sigla, nome]) => ({ sigla: sigla as SiglaDaUF, nome }),
)

/** Se o texto é uma sigla que o backend aceita. */
export function ehSiglaDaUF(valor: string): valor is SiglaDaUF {
  return Object.hasOwn(NOME_DA_UF, valor)
}
