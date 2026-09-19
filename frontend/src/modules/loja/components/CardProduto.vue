<script setup lang="ts">
/**
 * Produto na grade do catálogo.
 *
 * Sem moldura, sem sombra e sem fundo próprio: o que delimita o produto é o
 * bloco de cor, e o texto fica no papel. O card inteiro é o link, então a
 * área de clique é grande no celular.
 */
import { RouterLink } from 'vue-router'

import { moeda } from '@/utils/formato'
import BlocoDoProduto from './BlocoDoProduto.vue'
import type { Produto } from '../types'

defineProps<{ produto: Produto }>()
</script>

<template>
  <article class="card">
    <RouterLink class="card__link" :to="{ name: 'produto', params: { id: produto.id } }">
      <BlocoDoProduto
        :categoria="produto.categoria"
        :sku="produto.sku"
        :esgotado="!produto.em_estoque"
      />

      <h3 class="card__nome">{{ produto.nome }}</h3>
    </RouterLink>

    <p class="card__marca">{{ produto.marca }}</p>

    <p class="card__preco numerico">
      {{ moeda(produto.preco) }}
      <span v-if="!produto.em_estoque" class="card__esgotado">Esgotado</span>
    </p>
  </article>
</template>

<style scoped>
.card__link {
  display: block;
  text-decoration: none;
}

.card__link:hover .card__nome {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.card__nome {
  margin-top: var(--e3);
  font-size: var(--texto-base);
  font-weight: 700;
  font-stretch: 92%;
  line-height: 1.2;
}

.card__marca {
  margin-top: var(--e1);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.card__preco {
  display: flex;
  align-items: baseline;
  gap: var(--e2);
  flex-wrap: wrap;
  margin-top: var(--e2);
  font-size: var(--texto-base);
  font-weight: 600;
}

.card__esgotado {
  font-size: var(--texto-xs);
  font-weight: 600;
  color: var(--tinta-media);
}
</style>
