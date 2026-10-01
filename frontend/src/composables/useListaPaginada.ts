/**
 * Lista paginada pela rota.
 *
 * A página vem de `?pagina=`, e mudar a página — ou o que mais a busca
 * observar, como o termo buscado — busca de novo. Quem usa só diz como buscar
 * uma página; itens, total e o "não veio nada" saem daqui, iguais em toda
 * lista.
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { paginaDaRota } from '@/services/paginacao'
import type { Paginado } from '@/types/api'
import { useRequisicao } from './useRequisicao'

export function useListaPaginada<T>(
  buscar: (pagina: number) => Promise<Paginado<T>>,
  observar: () => unknown = () => undefined,
) {
  const rota = useRoute()
  const pagina = computed(() => paginaDaRota(rota.query.pagina))

  const requisicao = useRequisicao(() => buscar(pagina.value))

  watch(
    () => [pagina.value, observar()],
    () => void requisicao.executar(),
  )

  const itens = computed(() => requisicao.dados.value?.results ?? [])
  const total = computed(() => requisicao.dados.value?.count ?? 0)
  const vazio = computed(
    () => requisicao.respondeu.value && !requisicao.erro.value && itens.value.length === 0,
  )

  return { ...requisicao, pagina, itens, total, vazio }
}
