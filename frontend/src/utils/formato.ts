/**
 * Apresentação de número e dinheiro.
 *
 * O backend manda `DecimalField` como texto ('49.90') para não perder
 * precisão no caminho. Aqui esse texto vira leitura humana — e só isso: conta
 * de dinheiro é do servidor, sempre.
 */
import { LOCALE, MOEDA } from '@/app/config'

const DINHEIRO = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: MOEDA })
const NUMERO = new Intl.NumberFormat(LOCALE)
const DATA = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short' })
const DATA_HORA = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short' })

/** Traço quando não há valor: melhor que 'NaN' ou um zero que engana. */
const VAZIO = '—'

function comoNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null
  }
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

export function moeda(valor: string | number | null | undefined): string {
  const numero = comoNumero(valor)
  return numero === null ? VAZIO : DINHEIRO.format(numero)
}

export function numero(valor: string | number | null | undefined): string {
  const convertido = comoNumero(valor)
  return convertido === null ? VAZIO : NUMERO.format(convertido)
}

/**
 * Soma valores em dinheiro, em centavos.
 *
 * Existe só para o resumo antes do fechamento, onde a tela precisa mostrar
 * uma linha de total juntando subtotal e frete. O valor oficial nunca sai
 * daqui: ele vem do pedido que o servidor devolve.
 *
 * A conta é feita em centavos porque `49.90 + 24.90` em ponto flutuante dá
 * 74.80000000000001, e um centavo a mais na tela é um centavo a explicar.
 */
export function somarDinheiro(...valores: Array<string | number | null | undefined>): string {
  const centavos = valores.reduce<number>((soma, valor) => {
    const convertido = comoNumero(valor)
    return soma + (convertido === null ? 0 : Math.round(convertido * 100))
  }, 0)
  return (centavos / 100).toFixed(2)
}

/**
 * Data vinda da API.
 *
 * O backend guarda em UTC e serializa em ISO 8601; o navegador converte para
 * o fuso de quem está olhando, que é o que a pessoa espera ver.
 */
function comoData(valor: string | null | undefined): Date | null {
  if (!valor) {
    return null
  }
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

export function data(valor: string | null | undefined): string {
  const convertida = comoData(valor)
  return convertida === null ? VAZIO : DATA.format(convertida)
}

export function dataHora(valor: string | null | undefined): string {
  const convertida = comoData(valor)
  return convertida === null ? VAZIO : DATA_HORA.format(convertida)
}

/** Só os dígitos. O backend recusa CEP com pontuação. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** CEP para leitura: 01001000 vira 01001-000. */
export function cep(valor: string | null | undefined): string {
  const digitos = apenasDigitos(valor ?? '')
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : (valor ?? '')
}
