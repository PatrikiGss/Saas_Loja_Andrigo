<script setup lang="ts">
/** Subtotal, frete e total do pedido, como o servidor os gravou. */
import { moeda } from '@/utils/formato'
import type { Pedido } from '../types'

defineProps<{ pedido: Pedido }>()
</script>

<template>
  <dl class="valores">
    <div class="valores__linha">
      <dt>Subtotal</dt>
      <dd class="numerico">{{ moeda(pedido.subtotal) }}</dd>
    </div>
    <div class="valores__linha">
      <dt>Frete</dt>
      <dd class="numerico">{{ moeda(pedido.frete) }}</dd>
    </div>
    <div class="valores__linha valores__linha--total">
      <dt>Total</dt>
      <dd class="numerico">{{ moeda(pedido.total) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.valores {
  max-width: 22rem;
  margin: 0;
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
