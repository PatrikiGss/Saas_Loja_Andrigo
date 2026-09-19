<script setup lang="ts">
/**
 * Itens da compra.
 *
 * Nome, SKU e preço unitário são cópias congeladas no fechamento: se o
 * produto mudar de nome ou de preço depois, o histórico não muda junto.
 */
import { moeda } from '@/utils/formato'
import type { ItemPedido } from '../types'

defineProps<{ itens: ItemPedido[] }>()
</script>

<template>
  <ul class="itens">
    <li v-for="item in itens" :key="item.sku" class="item">
      <span class="item__descricao">
        <span class="item__nome">
          <span class="numerico">{{ item.quantidade }}</span> × {{ item.nome }}
        </span>
        <span class="item__unitario numerico">
          {{ moeda(item.preco_unitario) }} cada
        </span>
      </span>
      <span class="item__valor numerico">{{ moeda(item.subtotal) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.itens {
  list-style: none;
  padding: 0;
  margin-top: var(--e2);
}

.item {
  display: flex;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e3) 0;
  border-bottom: 1px solid var(--linha);
  font-size: var(--texto-sm);
}

.item__descricao {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}

.item__unitario {
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.item__valor {
  font-weight: 600;
  white-space: nowrap;
}
</style>
