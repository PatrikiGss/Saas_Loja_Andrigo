/**
 * Configuração de ambiente.
 *
 * Fica num lugar só para que nenhum módulo leia `import.meta.env` espalhado.
 * Os valores padrão apontam para o backend em desenvolvimento, então a
 * aplicação sobe sem nenhum arquivo `.env` presente.
 */

function texto(valor: string | undefined, padrao: string): string {
  const limpo = valor?.trim()
  return limpo ? limpo : padrao
}

function inteiro(valor: string | undefined, padrao: number): number {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? numero : padrao
}

/** Base de todas as chamadas. Sem barra no fim: os caminhos começam com uma. */
export const URL_DA_API = texto(import.meta.env.VITE_API_URL, 'http://localhost:8000/api').replace(
  /\/+$/,
  '',
)

/** Teto de espera por resposta. Acima disso a requisição vira erro de tempo. */
export const TEMPO_LIMITE_MS = inteiro(import.meta.env.VITE_TIMEOUT_MS, 15_000)

/** Nome exibido na interface. Provisório: a marca ainda não foi definida. */
export const NOME_DA_LOJA = 'Loja de pods'

/**
 * Formato do dinheiro na tela.
 *
 * O backend não guarda moeda em lugar nenhum: ele devolve o número e pronto.
 * O padrão aqui acompanha o resto do modelo, que é brasileiro (CEP, UF, frete
 * por região) — e é uma variável de ambiente justamente porque a loja não vai
 * operar no Brasil e essa escolha ainda não foi feita.
 */
export const LOCALE = texto(import.meta.env.VITE_LOCALE, 'pt-BR')
export const MOEDA = texto(import.meta.env.VITE_MOEDA, 'BRL')
