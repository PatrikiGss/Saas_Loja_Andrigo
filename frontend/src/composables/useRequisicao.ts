/**
 * Ciclo de vida de uma leitura da API: carregando, sucesso, erro, vazio.
 *
 * Existe para que nenhuma tela reescreva os mesmos três `ref` e o mesmo
 * `try/catch`. Toda view que depende da API usa isto e ganha de graça o botão
 * de tentar de novo e a proteção contra resposta atrasada.
 */
import { computed, onMounted, ref, shallowRef, type ComputedRef, type Ref } from 'vue'

import { deErro, type ErroDaApi } from '@/services/erros'

export interface OpcoesDaRequisicao {
  /** Dispara assim que o componente monta. Verdadeiro por padrão. */
  imediato?: boolean
}

export interface Requisicao<T> {
  dados: Ref<T | null>
  carregando: Ref<boolean>
  erro: Ref<ErroDaApi | null>
  /** Já respondeu alguma vez? Separa 'ainda não carregou' de 'carregou vazio'. */
  respondeu: Ref<boolean>
  /** Terminou bem e não trouxe nada. */
  vazio: ComputedRef<boolean>
  executar: () => Promise<T | null>
}

export function useRequisicao<T>(
  buscar: () => Promise<T>,
  opcoes: OpcoesDaRequisicao = {},
): Requisicao<T> {
  const dados = shallowRef<T | null>(null)
  const carregando = ref(false)
  const erro = shallowRef<ErroDaApi | null>(null)
  const respondeu = ref(false)

  // Só a chamada mais recente pode escrever no estado. Sem isto, uma busca
  // lenta disparada antes sobrescreveria o resultado de uma busca posterior.
  let chamadaAtual = 0

  async function executar(): Promise<T | null> {
    const estaChamada = (chamadaAtual += 1)
    carregando.value = true
    erro.value = null

    try {
      const resultado = await buscar()
      if (estaChamada !== chamadaAtual) {
        return null
      }
      dados.value = resultado
      return resultado
    } catch (falha) {
      if (estaChamada === chamadaAtual) {
        erro.value = deErro(falha)
      }
      return null
    } finally {
      if (estaChamada === chamadaAtual) {
        carregando.value = false
        respondeu.value = true
      }
    }
  }

  const vazio = computed(() => {
    if (!respondeu.value || erro.value !== null) {
      return false
    }
    const valor = dados.value
    return valor === null || (Array.isArray(valor) && valor.length === 0)
  })

  if (opcoes.imediato !== false) {
    onMounted(executar)
  }

  return { dados, carregando, erro, respondeu, vazio, executar }
}
