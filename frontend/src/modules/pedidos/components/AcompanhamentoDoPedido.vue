<script setup lang="ts">
/**
 * Onde o pedido está no caminho até a entrega.
 *
 * Vertical, e não em faixa horizontal: cinco rótulos não cabem lado a lado em
 * um celular, e quebrar a faixa em duas linhas desmonta a ideia de percurso.
 * De pé, a mesma marcação serve em qualquer largura e ainda lembra a leitura
 * de um rastreio.
 *
 * Cancelado não entra no percurso porque não é etapa: é saída. O pedido
 * cancelado mostra só isso, sem sugerir que faltavam passos.
 */
import { computed } from 'vue'

import { FLUXO, textoDoStatus, type StatusPedido } from '../types'

const props = defineProps<{ status: StatusPedido }>()

const cancelado = computed(() => props.status === 'cancelado')
const posicaoAtual = computed(() => FLUXO.indexOf(props.status))

function estado(indice: number): 'cumprido' | 'atual' | 'futuro' {
  if (indice < posicaoAtual.value) return 'cumprido'
  if (indice === posicaoAtual.value) return 'atual'
  return 'futuro'
}
</script>

<template>
  <div v-if="cancelado" class="cancelado">
    <p class="cancelado__texto">{{ textoDoStatus('cancelado') }}</p>
    <p class="cancelado__nota">Este pedido não segue para entrega.</p>
  </div>

  <ol v-else class="trilha">
    <li
      v-for="(etapa, indice) in FLUXO"
      :key="etapa"
      class="etapa"
      :class="`etapa--${estado(indice)}`"
      :aria-current="estado(indice) === 'atual' ? 'step' : undefined"
    >
      <span class="etapa__marca" aria-hidden="true" />
      <span class="etapa__texto">{{ textoDoStatus(etapa) }}</span>
      <span v-if="estado(indice) === 'atual'" class="apenas-leitor">(etapa atual)</span>
    </li>
  </ol>
</template>

<style scoped>
.trilha {
  list-style: none;
  padding: 0;
  margin: 0;
}

.etapa {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--e3);
  padding: var(--e2) 0;
}

/* A linha que liga uma etapa à seguinte. A última não tem para onde ligar. */
.etapa:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 0.3125rem;
  top: 1.5rem;
  bottom: -0.25rem;
  width: 1px;
  background: var(--linha-forte);
}

.etapa__marca {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
  border: 1.5px solid var(--linha-forte);
  background: var(--papel);
  position: relative;
  z-index: 1;
}

.etapa__texto {
  font-size: var(--texto-sm);
  color: var(--tinta-fraca);
}

.etapa--cumprido .etapa__marca {
  border-color: var(--tinta);
  background: var(--tinta);
}

.etapa--cumprido .etapa__texto {
  color: var(--tinta-media);
}

.etapa--atual .etapa__marca {
  border-color: var(--tinta);
  box-shadow: inset 0 0 0 2px var(--papel);
  background: var(--tinta);
}

.etapa--atual .etapa__texto {
  color: var(--tinta);
  font-weight: 700;
}

.cancelado {
  padding-left: var(--e4);
  border-left: 3px solid var(--tinta-media);
}

.cancelado__texto {
  font-weight: 700;
}

.cancelado__nota {
  margin-top: var(--e1);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}
</style>
