/**
 * Leitura de listas paginadas.
 *
 * O backend pagina de 20 em 20 e não aceita `page_size` do cliente, então uma
 * lista curta que a interface precisa inteira — os subtipos do catálogo, por
 * exemplo — pode chegar cortada. `coletarTudo` percorre as páginas seguindo o
 * `next` que a própria API devolve.
 */
import { http } from './http'
import type { Paginado } from '@/types/api'

/** Teto de páginas, para que uma resposta inesperada não vire laço infinito. */
const PAGINAS_MAXIMAS = 25

export async function coletarTudo<T>(caminho: string): Promise<T[]> {
  const itens: T[] = []
  let proximo: string | null = caminho

  for (let pagina = 0; proximo !== null && pagina < PAGINAS_MAXIMAS; pagina += 1) {
    const { data }: { data: Paginado<T> } = await http.get<Paginado<T>>(proximo)
    itens.push(...data.results)
    proximo = data.next
  }

  return itens
}
