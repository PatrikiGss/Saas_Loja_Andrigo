/**
 * Leitura de listas paginadas.
 *
 * O backend pagina de 20 em 20 e não aceita `page_size` do cliente, então uma
 * lista curta que a interface precisa inteira — os subtipos do catálogo, por
 * exemplo — pode chegar cortada. `coletarTudo` percorre as páginas seguindo o
 * `next` que a própria API devolve.
 */
import { paginaDe } from './conferencia'
import { http } from './http'
import type { Paginado } from '@/types/api'

/** Tamanho da página do backend (`PAGE_SIZE` do DRF), que não aceita outro. */
export const POR_PAGINA = 20

/** A página pedida na rota (`?pagina=`), ou a primeira se não houver uma válida. */
export function paginaDaRota(valor: unknown): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 1 ? numero : 1
}

/** Teto de páginas, para que uma resposta inesperada não vire laço infinito. */
const PAGINAS_MAXIMAS = 25

export async function coletarTudo<T>(
  caminho: string,
  chaves: ReadonlyArray<keyof T & string> = [],
): Promise<T[]> {
  const itens: T[] = []
  let proximo: string | null = caminho

  for (let pagina = 0; proximo !== null && pagina < PAGINAS_MAXIMAS; pagina += 1) {
    const resposta: { data: Paginado<T> } = await http.get<Paginado<T>>(proximo)
    const conferida = paginaDe<T>(resposta.data, chaves)
    itens.push(...conferida.results)
    proximo = conferida.next
  }

  return itens
}
