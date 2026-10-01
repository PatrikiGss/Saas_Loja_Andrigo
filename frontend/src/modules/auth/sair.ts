/**
 * O botão "Sair" da loja e da gestão: encerra a sessão e volta para a
 * vitrine, com o estado de "saindo" para o botão mostrar que está trabalhando.
 *
 * Fica num lugar só para as duas molduras não divergirem: se sair um dia
 * precisar limpar mais alguma coisa, é aqui.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSessao } from './stores/sessao'

export function useSair() {
  const router = useRouter()
  const sessao = useSessao()
  const saindo = ref(false)

  async function sair(): Promise<void> {
    saindo.value = true
    try {
      await sessao.sair()
      await router.push('/')
    } finally {
      saindo.value = false
    }
  }

  return { saindo, sair }
}
