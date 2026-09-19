<script setup lang="ts">
/**
 * Especificações do produto.
 *
 * O backend guarda cada especificação apenas nas categorias em que ela se
 * aplica, e devolve nulo nas demais. Aqui só entra o que veio preenchido:
 * 'puffs: —' num vaporizador de ervas não informaria nada.
 */
import { computed } from 'vue'

import { numero } from '@/utils/formato'
import type { Produto } from '../types'

const props = defineProps<{
  produto: Produto
  /** Nome legível do subtipo, que vem de `/api/subtipos/`. */
  subtipo?: string
}>()

interface Especificacao {
  rotulo: string
  valor: string
}

const especificacoes = computed<Especificacao[]>(() => {
  const lista: Especificacao[] = []
  const { puffs, volume_ml, nicotina_mg_ml } = props.produto

  if (props.subtipo) {
    lista.push({ rotulo: 'Tipo', valor: props.subtipo })
  }
  if (puffs !== null) {
    lista.push({ rotulo: 'Puffs', valor: numero(puffs) })
  }
  if (volume_ml !== null) {
    lista.push({ rotulo: 'Volume', valor: `${numero(volume_ml)} ml` })
  }
  if (nicotina_mg_ml !== null) {
    lista.push({ rotulo: 'Nicotina', valor: `${numero(nicotina_mg_ml)} mg/ml` })
  }
  return lista
})
</script>

<template>
  <dl v-if="especificacoes.length" class="especificacoes">
    <div v-for="item in especificacoes" :key="item.rotulo" class="especificacoes__linha">
      <dt class="especificacoes__rotulo">{{ item.rotulo }}</dt>
      <dd class="especificacoes__valor" :class="{ numerico: item.rotulo !== 'Tipo' }">
        {{ item.valor }}
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.especificacoes {
  margin: 0;
  border-top: 1px solid var(--linha);
}

.especificacoes__linha {
  display: flex;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e3) 0;
  border-bottom: 1px solid var(--linha);
}

.especificacoes__rotulo {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.especificacoes__valor {
  margin: 0;
  font-size: var(--texto-sm);
  font-weight: 600;
}
</style>
