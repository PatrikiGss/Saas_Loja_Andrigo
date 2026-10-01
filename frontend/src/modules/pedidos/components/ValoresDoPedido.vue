<script setup lang="ts">
/**
 * Subtotal, frete e total.
 *
 * Recebe os três valores, e não o pedido, porque também desenha o resumo
 * antes do fechamento — quando ainda não há pedido, e o total é a soma de
 * apresentação de dois valores que vieram do servidor.
 */
import { moeda } from '@/utils/formato'
import type { Pedido } from '../types'

defineProps<{ valores: Pick<Pedido, 'subtotal' | 'frete' | 'total'> }>()
</script>

<template>
  <dl class="valores">
    <div class="valores__linha">
      <dt>Subtotal</dt>
      <dd class="numerico">{{ moeda(valores.subtotal) }}</dd>
    </div>
    <div class="valores__linha">
      <dt>Frete</dt>
      <dd class="numerico">{{ moeda(valores.frete) }}</dd>
    </div>
    <div class="valores__linha valores__linha--total">
      <dt>Total</dt>
      <dd class="numerico">{{ moeda(valores.total) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
/* Sem margem própria: o reset já zera, e o espaço em volta é de quem usa. */
.valores {
  max-width: 22rem;
  border-top: 1px solid var(--linha);
}

.valores__linha {
  display: flex;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e2) 0;
  font-size: var(--texto-sm);
}

.valores__linha dd {
  margin: 0;
  font-weight: 600;
}

.valores__linha--total {
  padding-top: var(--e3);
  border-top: 1px solid var(--linha);
  font-size: var(--texto-md);
  font-weight: 700;
}
</style>
