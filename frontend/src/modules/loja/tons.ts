/**
 * Tom do bloco de cor de cada produto.
 *
 * A categoria dá o matiz; o produto dá o tom dentro dele. Sem isso, uma
 * página com trinta essências seria trinta retângulos verdes idênticos, e o
 * código de cor deixaria de ajudar a distinguir qualquer coisa.
 *
 * O tom sai do SKU, então é estável: o mesmo produto tem sempre o mesmo tom,
 * em qualquer sessão e em qualquer ordenação, sem nada guardado no banco.
 */

export interface Tom {
  /** Com o que o matiz é misturado: a tinta escurece, o papel clareia. */
  base: string
  quantidade: string
}

/**
 * Escada de cinco degraus em volta do matiz puro, dois para o escuro e dois
 * para o claro.
 *
 * Misturar só com o papel não servia: os matizes já claros — o verde da
 * essência, principalmente — chegavam perto do fundo nos degraus altos, e
 * sumiam de vez quando o produto esgotado reduzia a opacidade por cima.
 * Descendo também para a tinta, todo degrau continua tendo corpo.
 */
const PASSOS: readonly Tom[] = [
  { base: 'var(--tinta)', quantidade: '20%' },
  { base: 'var(--tinta)', quantidade: '9%' },
  { base: 'var(--papel)', quantidade: '0%' },
  { base: 'var(--papel)', quantidade: '15%' },
  { base: 'var(--papel)', quantidade: '30%' },
]

function embaralhar(texto: string): number {
  let valor = 0
  for (let i = 0; i < texto.length; i += 1) {
    // `>>> 0` mantém o número inteiro sem sinal, então o resto nunca é negativo.
    valor = (valor * 31 + texto.charCodeAt(i)) >>> 0
  }
  return valor
}

export function tomDoProduto(sku: string): Tom {
  return PASSOS[embaralhar(sku) % PASSOS.length]
}
