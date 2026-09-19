<script setup lang="ts">
/**
 * Onde a pessoa está no fechamento.
 *
 * Numerado porque aqui o conteúdo é mesmo uma sequência: endereço vem antes
 * de frete, que vem antes do resumo. Passo já cumprido volta a ser clicável;
 * passo à frente não, porque depende do que ainda não foi escolhido.
 */
import { PASSOS, type Passo } from '../types'

defineProps<{ atual: Passo }>()
const emit = defineEmits<{ voltarPara: [passo: Passo] }>()

function indice(passo: Passo): number {
  return PASSOS.findIndex((item) => item.id === passo)
}
</script>

<template>
  <ol class="passos">
    <li
      v-for="(passo, posicao) in PASSOS"
      :key="passo.id"
      class="passo"
      :class="{
        'passo--atual': passo.id === atual,
        'passo--cumprido': posicao < indice(atual),
      }"
      :aria-current="passo.id === atual ? 'step' : undefined"
    >
      <button
        v-if="posicao < indice(atual)"
        type="button"
        class="passo__botao"
        @click="emit('voltarPara', passo.id)"
      >
        <span class="passo__numero numerico">{{ posicao + 1 }}</span>
        {{ passo.texto }}
      </button>

      <span v-else class="passo__estatico">
        <span class="passo__numero numerico">{{ posicao + 1 }}</span>
        {{ passo.texto }}
      </span>
    </li>
  </ol>
</template>

<style scoped>
.passos {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e5);
  list-style: none;
  padding: 0;
  margin-bottom: var(--e6);
  border-bottom: 1px solid var(--linha);
}

.passo__botao,
.passo__estatico {
  display: inline-flex;
  align-items: center;
  gap: var(--e2);
  padding: 0 0 var(--e3);
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font: inherit;
  font-size: var(--texto-sm);
  color: var(--tinta-fraca);
}

.passo__botao {
  cursor: pointer;
}

.passo--cumprido .passo__botao {
  color: var(--tinta-media);
}

.passo--cumprido .passo__botao:hover {
  color: var(--tinta);
}

.passo--atual .passo__estatico {
  color: var(--tinta);
  font-weight: 700;
  border-bottom-color: var(--tinta);
}

.passo__numero {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}
</style>
