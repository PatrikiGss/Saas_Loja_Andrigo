/**
 * Para onde vai quem responde que não tem a idade mínima.
 *
 * Fora do site, e com `replace`: o voltar do navegador não traz de volta a
 * página que perguntou. Fica em módulo próprio para os testes poderem trocar
 * a saída por um dublê — sair de verdade derrubaria o próprio teste.
 */
const DESTINO_DE_QUEM_SAI = 'https://www.google.com/'

export function sairDoSite(): void {
  window.location.replace(DESTINO_DE_QUEM_SAI)
}
