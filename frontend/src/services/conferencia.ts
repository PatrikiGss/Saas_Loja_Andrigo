/**
 * Conferência da forma das respostas da API.
 *
 * A tipagem do TypeScript some na compilação: ela descreve o que a API
 * *deveria* devolver, e o código acredita. Se um serializer mudar, nada
 * percebe — a tela quebra no meio do desenho, com um erro que não diz nada
 * sobre a causa.
 *
 * O que estas funções fazem é conferir a forma no momento em que a resposta
 * chega, e transformar o desencontro em um `ErroDaApi` comum, igual a
 * qualquer outra falha: a tela mostra a mesma faixa de erro em vez de
 * quebrar.
 *
 * **O que elas não fazem:** conferir tipo campo a campo. Um `preco` que
 * virasse número em vez de texto passaria. Isso é deliberado — validar cada
 * campo exigiria escrever os esquemas inteiros aqui, criando uma segunda
 * descrição do backend para sair do ar em silêncio quando a primeira mudar.
 * O que se confere é o que o código realmente pressupõe para funcionar.
 */
import { ErroDaApi } from './erros'
import type { Paginado } from '@/types/api'

/** Lançado quando a resposta não tem a forma que o código pressupõe. */
function respostaInesperada(): ErroDaApi {
  return new ErroDaApi(
    'desconhecido',
    'A loja respondeu de um jeito que esta versão do site não entende. Recarregue a página.',
    null,
    {},
  )
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Confere que a resposta é um objeto e traz as chaves que o código vai usar.
 *
 * `chaves` é o mínimo de que aquela tela depende, e não o serializer inteiro:
 * campo que a interface não lê não precisa estar presente para ela funcionar.
 */
export function objetoCom<T>(valor: unknown, chaves: ReadonlyArray<keyof T & string>): T {
  if (!ehObjeto(valor) || chaves.some((chave) => !(chave in valor))) {
    throw respostaInesperada()
  }
  return valor as T
}

/**
 * Confere que a resposta é uma lista, e cada item, um objeto com as chaves.
 *
 * Sem chaves declaradas, confere só que é lista: quem chamou não disse
 * depender de campo nenhum, e exigir objeto recusaria uma lista de textos,
 * que é resposta legítima.
 */
export function listaDe<T>(valor: unknown, chaves: ReadonlyArray<keyof T & string>): T[] {
  if (!Array.isArray(valor)) {
    throw respostaInesperada()
  }
  if (chaves.length === 0) {
    return valor as T[]
  }
  return valor.map((item) => objetoCom<T>(item, chaves))
}

/**
 * Confere a página do `PageNumberPagination`.
 *
 * `results` precisa ser lista e `count` número: é com eles que a paginação
 * calcula quantas páginas existem, e um `count` ausente viraria `NaN` na
 * conta em vez de erro.
 */
export function paginaDe<T>(valor: unknown, chaves: ReadonlyArray<keyof T & string>): Paginado<T> {
  const pagina = objetoCom<Paginado<T>>(valor, ['count', 'next', 'previous', 'results'])

  if (typeof pagina.count !== 'number' || !Array.isArray(pagina.results)) {
    throw respostaInesperada()
  }

  return { ...pagina, results: listaDe<T>(pagina.results, chaves) }
}
