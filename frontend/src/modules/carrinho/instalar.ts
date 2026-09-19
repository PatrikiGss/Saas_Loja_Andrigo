/**
 * Liga o carrinho à sessão.
 *
 * O carrinho existe por conta e exige autenticação, então ele é carregado
 * quando alguém entra e esquecido quando alguém sai — senão a contagem do
 * cabeçalho continuaria mostrando os itens de quem acabou de deixar o
 * navegador.
 */
import { watch } from 'vue'

import { useSessao } from '@/modules/auth/stores/sessao'
import { useCarrinho } from './stores/carrinho'

export function instalarCarrinho(): void {
  const sessao = useSessao()
  const carrinho = useCarrinho()

  watch(
    () => sessao.autenticado,
    (autenticado) => {
      if (autenticado) {
        void carrinho.carregar()
      } else {
        carrinho.esquecer()
      }
    },
    // Na partida a sessão ainda não foi restaurada pelo cookie; o observador
    // dispara de novo assim que ela for.
    { immediate: true },
  )
}
