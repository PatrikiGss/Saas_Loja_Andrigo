/**
 * Para onde voltar depois de entrar.
 *
 * O caminho vem da barra de endereço, então é entrada de fora e passa por
 * conferência: só caminho interno é aceito, e `//qualquer.coisa` é recusado
 * porque o navegador leria isso como outro servidor.
 */
const PADRAO = '/'

export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//')) {
    return PADRAO
  }
  return valor
}
