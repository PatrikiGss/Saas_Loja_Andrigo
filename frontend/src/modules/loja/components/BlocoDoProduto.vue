<script setup lang="ts">
/**
 * O bloco de cor que ocupa o lugar da foto.
 *
 * O catálogo ainda não tem imagem de produto no backend. Em vez de um
 * retângulo cinza esperando por ela, o produto aparece pela cor: matiz da
 * categoria, tom do próprio produto. Quando a imagem existir, este é o único
 * componente que muda.
 *
 * O `background` aparece duas vezes de propósito: a primeira linha é o matiz
 * puro, que vale em navegador sem `color-mix`; a segunda refina com o tom.
 */
import { computed } from 'vue'

import { corDaCategoria } from '../categorias'
import { tomDoProduto } from '../tons'

const props = defineProps<{
  categoria: string
  sku: string
  /** Proporção do bloco. O card usa retrato; a página do produto, quadrado. */
  formato?: 'retrato' | 'quadrado'
  /** Produto fora de venda perde a força da cor. */
  esgotado?: boolean
}>()

const estilo = computed(() => {
  const tom = tomDoProduto(props.sku)
  return {
    '--matiz': corDaCategoria(props.categoria),
    '--tom-base': tom.base,
    '--tom': tom.quantidade,
  }
})
</script>

<template>
  <span
    class="bloco"
    :class="[`bloco--${formato ?? 'retrato'}`, { 'bloco--esgotado': esgotado }]"
    :style="estilo"
    aria-hidden="true"
  />
</template>

<style scoped>
.bloco {
  display: block;
  width: 100%;
  border-radius: var(--raio-bloco);
  background: var(--matiz);
  background: color-mix(in oklab, var(--matiz), var(--tom-base) var(--tom));
}

.bloco--retrato {
  aspect-ratio: 3 / 4;
}

.bloco--quadrado {
  aspect-ratio: 1 / 1;
}

/* Esgotado sai do primeiro plano, mas continua reconhecível: a 0.3 os tons
   claros chegavam perto do papel e a grade parecia quebrada. A informação não
   fica só na cor — o texto do card também diz 'Esgotado'. */
.bloco--esgotado {
  opacity: 0.45;
}
</style>
