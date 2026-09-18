/**
 * Liga a sessão à camada HTTP e ao router.
 *
 * É aqui, e só aqui, que os três se conhecem: o `http` não sabe o que é Pinia,
 * a store não sabe o que é interceptador, e o router não sabe de token.
 */
import type { Router } from 'vue-router'

import { registrarSessao } from '@/services/http'
import { useSessao } from './stores/sessao'

export function instalarSessao(router: Router): void {
  const sessao = useSessao()

  registrarSessao({
    tokenDeAcesso: () => sessao.token,
    renovar: () => sessao.renovar(),
    encerrar: () => {
      sessao.limpar()
      // Só tira a pessoa do lugar se o lugar exigia estar autenticada; na
      // vitrine, a sessão cair não é motivo para mudar de página.
      if (router.currentRoute.value.meta.exigeAutenticacao) {
        void router.push({
          name: 'entrar',
          query: { destino: router.currentRoute.value.fullPath },
        })
      }
    },
  })

  /**
   * Nenhuma navegação decide sobre autenticação antes de a sessão ter sido
   * tentada pelo cookie; sem isto, recarregar uma página protegida jogaria a
   * pessoa para o login mesmo com sessão válida.
   */
  router.beforeEach(async (para) => {
    await sessao.pronta()

    if (para.meta.exigeAutenticacao && !sessao.autenticado) {
      return { name: 'entrar', query: { destino: para.fullPath } }
    }

    if (para.meta.apenasVisitante && sessao.autenticado) {
      return { name: 'inicio' }
    }

    return true
  })
}
