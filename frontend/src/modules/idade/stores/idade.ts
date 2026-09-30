/**
 * Declaração de idade: a pergunta da entrada e a de antes do carrinho.
 *
 * É declaração, não verificação — quem mente passa. Serve para a loja deixar
 * claro, antes de mostrar qualquer coisa e de novo antes da compra, que o que
 * ela vende é só para maior de idade. O backend não participa: não há o que
 * ele possa conferir numa resposta de sim ou não.
 *
 * O "sim" vale pela sessão do navegador (`sessionStorage`): fechar a aba e
 * voltar pergunta de novo. Com o armazenamento bloqueado, vale só até
 * recarregar a página.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { sairDoSite } from '../sair'

/** Onde se pergunta: ao entrar no site, ou ao ir para o carrinho. */
export type Momento = 'entrada' | 'compra'

const CHAVE: Record<Momento, string> = {
  entrada: 'bigpuffs:idade:entrada',
  compra: 'bigpuffs:idade:compra',
}

function lembrado(momento: Momento): boolean {
  try {
    return sessionStorage.getItem(CHAVE[momento]) === 'sim'
  } catch {
    return false
  }
}

function lembrar(momento: Momento): void {
  try {
    sessionStorage.setItem(CHAVE[momento], 'sim')
  } catch {
    // Armazenamento bloqueado: a resposta vale só enquanto a página viver.
  }
}

interface Espera {
  momento: Momento
  resolver: (temIdade: boolean) => void
}

export const useIdade = defineStore('idade', () => {
  const confirmado = ref<Record<Momento, boolean>>({
    entrada: lembrado('entrada'),
    compra: lembrado('compra'),
  })
  const esperas = ref<Espera[]>([])

  /**
   * O que a tela pergunta agora. Com as duas pendentes — quem abre o carrinho
   * direto como primeira página —, pergunta uma vez só, a da compra: as duas
   * perguntas são a mesma, e um "sim" responde as duas.
   */
  const pergunta = computed<Momento | null>(() => {
    if (esperas.value.some((espera) => espera.momento === 'compra')) {
      return 'compra'
    }
    return esperas.value.length ? 'entrada' : null
  })

  /** Resolve com a resposta; na hora, se já foi respondido nesta sessão. */
  function confirmar(momento: Momento): Promise<boolean> {
    if (confirmado.value[momento]) {
      return Promise.resolve(true)
    }
    return new Promise((resolver) => {
      esperas.value.push({ momento, resolver })
    })
  }

  function responder(temIdade: boolean): void {
    const respondida = pergunta.value
    if (respondida === null) {
      return
    }

    const pendentes = esperas.value
    esperas.value = []

    if (!temIdade) {
      sairDoSite()
      pendentes.forEach((espera) => espera.resolver(false))
      return
    }

    const valem: Momento[] = respondida === 'compra' ? ['compra', 'entrada'] : ['entrada']
    for (const momento of valem) {
      confirmado.value[momento] = true
      lembrar(momento)
    }
    pendentes.forEach((espera) => espera.resolver(true))
  }

  return { pergunta, confirmar, responder }
})
