/**
 * Preparo comum a toda a suíte de unidade, carregado pelo Vitest antes de
 * cada arquivo (`setupFiles` no `vite.config.ts`).
 *
 * O jsdom não implementa o `<dialog>` modal. Aqui ele ganha o mínimo que os
 * componentes usam, com o mesmo efeito do navegador: abrir marca `open`, e
 * fechar desmarca e avisa com o evento `close`.
 *
 * Também não rola a janela: o `scrollBehavior` do roteador chama `scrollTo` a
 * cada navegação, e sem isto cada teste com o roteador de verdade avisa que o
 * método não existe. Não há o que rolar num documento sem layout.
 */
window.scrollTo = () => undefined

HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true
}

HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event('close'))
}
