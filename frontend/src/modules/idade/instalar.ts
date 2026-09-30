/**
 * Liga a pergunta de idade à partida da aplicação e ao router.
 *
 * Na partida, pergunta a quem acabou de chegar. No router, segura a
 * navegação para as rotas marcadas com `confirmaIdade` até a resposta: com
 * "sim" ela segue, com "não" a pessoa sai do site e a navegação é cancelada.
 *
 * Registrado depois da sessão, para que quem não entrou vá primeiro ao login
 * e só ouça a pergunta ao chegar de fato ao carrinho.
 */
import type { Router } from 'vue-router'

import { useIdade } from './stores/idade'

export function instalarVerificacaoDeIdade(router: Router): void {
  const idade = useIdade()

  void idade.confirmar('entrada')

  router.beforeEach(async (para) => {
    if (para.meta.confirmaIdade) {
      return await idade.confirmar('compra')
    }
  })
}
