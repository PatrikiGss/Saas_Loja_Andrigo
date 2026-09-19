<script setup lang="ts">
/**
 * Aviso de que ainda não dá para pagar.
 *
 * Este é o único lugar da aplicação que descreve a ausência do gateway, e ele
 * existe para ser o único a mudar quando o provedor entrar: a confirmação do
 * checkout e a página do pedido apontam as duas para cá.
 *
 * Só aparece enquanto o pagamento está pendente. Assim que o webhook começar
 * a marcar pedidos como pagos, o aviso some sozinho.
 */
import { TEXTO_DO_PAGAMENTO, type Pedido } from '../types'

defineProps<{ pedido: Pedido }>()
</script>

<template>
  <div v-if="pedido.status_pagamento === 'pendente'" class="aviso">
    <p class="aviso__estado">Pagamento {{ TEXTO_DO_PAGAMENTO.pendente.toLowerCase() }}</p>
    <p class="aviso__texto">
      O pagamento ainda não está disponível nesta loja. Seu pedido fica guardado com estes
      valores até que o pagamento seja liberado.
    </p>
  </div>
</template>

<style scoped>
.aviso {
  padding-left: var(--e4);
  border-left: 3px solid var(--tinta);
  max-width: 34rem;
}

.aviso__estado {
  font-weight: 700;
}

.aviso__texto {
  margin-top: var(--e2);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}
</style>
