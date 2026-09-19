<script setup lang="ts">
/**
 * Navegação entre páginas de uma lista da API.
 *
 * O backend pagina de 20 em 20 e não aceita tamanho de página do cliente, e o
 * que ele devolve é `count`, `next` e `previous` — ou seja, dá para saber se
 * existe página seguinte, mas não para montar uma régua de números sem
 * recalcular o total. É por isso que o controle é anterior/próxima com a
 * posição escrita no meio.
 */
import { computed } from 'vue'

import BotaoBase from './BotaoBase.vue'

const props = defineProps<{
  pagina: number
  /** Total de itens, de `count`. */
  total: number
  /** Itens por página, para saber quantas páginas existem. */
  porPagina: number
  desabilitado?: boolean
}>()

const emit = defineEmits<{ irPara: [pagina: number] }>()

const paginas = computed(() => Math.max(1, Math.ceil(props.total / props.porPagina)))
const temAnterior = computed(() => props.pagina > 1)
const temProxima = computed(() => props.pagina < paginas.value)
</script>

<template>
  <nav v-if="paginas > 1" class="paginacao" aria-label="Páginas de produtos">
    <BotaoBase
      variante="secundario"
      :desabilitado="!temAnterior || desabilitado"
      @click="emit('irPara', pagina - 1)"
    >
      Anterior
    </BotaoBase>

    <p class="paginacao__posicao" aria-live="polite">
      Página <span class="numerico">{{ pagina }}</span> de
      <span class="numerico">{{ paginas }}</span>
    </p>

    <BotaoBase
      variante="secundario"
      :desabilitado="!temProxima || desabilitado"
      @click="emit('irPara', pagina + 1)"
    >
      Próxima
    </BotaoBase>
  </nav>
</template>

<style scoped>
.paginacao {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--e4);
  margin-top: var(--e7);
  padding-top: var(--e5);
  border-top: 1px solid var(--linha);
}

.paginacao__posicao {
  margin: 0;
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}
</style>
