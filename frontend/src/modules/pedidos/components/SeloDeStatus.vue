<script setup lang="ts">
/**
 * Status do pedido em uma linha, para a lista do histórico.
 *
 * Sem cor: na loja a cor significa categoria de produto, e um status pintado
 * de verde ou vermelho disputaria esse significado. Quem carrega a diferença
 * é o quadrado — cheio para o que já aconteceu, vazado para o que espera,
 * riscado para o que foi cancelado — junto com o texto, que é o que o leitor
 * de tela anuncia.
 */
import { computed } from 'vue'

import { FLUXO, textoDoStatus, type StatusPedido } from '../types'

const props = defineProps<{ status: StatusPedido }>()

const forma = computed(() => {
  if (props.status === 'cancelado') {
    return 'cancelado'
  }
  return props.status === FLUXO[FLUXO.length - 1] ? 'concluido' : 'andamento'
})
</script>

<template>
  <span class="selo" :class="`selo--${forma}`">
    <span class="selo__marca" aria-hidden="true" />
    {{ textoDoStatus(status) }}
  </span>
</template>

<style scoped>
.selo {
  display: inline-flex;
  align-items: center;
  gap: var(--e2);
  font-size: var(--texto-xs);
  font-weight: 600;
}

.selo__marca {
  width: 0.5rem;
  height: 0.5rem;
  flex: none;
  border: 1.5px solid var(--tinta);
}

.selo--concluido .selo__marca {
  background: var(--tinta);
}

.selo--cancelado {
  color: var(--tinta-media);
}

.selo--cancelado .selo__marca {
  border-color: var(--tinta-media);
  background: repeating-linear-gradient(
    -45deg,
    var(--tinta-media) 0 1px,
    transparent 1px 3px
  );
}
</style>
