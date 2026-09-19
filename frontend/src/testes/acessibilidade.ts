/**
 * Auditoria de acessibilidade com o axe.
 *
 * Substitui a inspeção a olho: são as regras do WCAG aplicadas ao que o
 * componente realmente desenhou. Não é garantia de que a tela é utilizável
 * por todo mundo — nenhuma ferramenta automática é — mas pega a classe de
 * defeito que passa despercebida: campo sem rótulo, botão sem nome
 * acessível, cabeçalho fora de ordem, `aria-*` apontando para o nada.
 *
 * `color-contrast` fica desligado porque o jsdom não pinta nada: a regra
 * precisa de cor calculada de verdade, e no teste ela só daria resultado
 * inventado. O contraste da paleta foi decidido nos tokens.
 */
import axe, { type Result } from 'axe-core'

export interface Auditavel {
  element: Element
  unmount: () => void
}

/**
 * Roda o axe no que foi montado e devolve o que ele reprovou.
 *
 * O componente precisa estar preso ao documento — regras de foco e de rótulo
 * dependem de estar na árvore de verdade, e não num fragmento solto.
 */
export async function auditar(montado: Auditavel): Promise<Result[]> {
  const { violations } = await axe.run(montado.element, {
    rules: { 'color-contrast': { enabled: false } },
  })
  return violations
}

/** Resumo legível de cada reprovação, para a falha do teste dizer o que houve. */
export function descrever(violacoes: Result[]): string {
  return violacoes
    .map((violacao) => {
      const onde = violacao.nodes.map((no) => no.html).join(' | ')
      return `${violacao.id}: ${violacao.help} → ${onde}`
    })
    .join('\n')
}
