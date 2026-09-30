<script setup lang="ts">
/**
 * A moldura muda com a rota.
 *
 * A gestão tem barra própria para não haver dúvida de onde se está — e para
 * que o carrinho e o nome de quem entrou, que pertencem ao fluxo de compra,
 * não apareçam no meio de uma tela que altera o catálogo dos outros.
 */
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import LayoutAdmin from '@/modules/admin/layouts/LayoutAdmin.vue'
import LayoutLoja from '@/layouts/LayoutLoja.vue'
import PerguntaDeIdade from '@/modules/idade/components/PerguntaDeIdade.vue'

const rota = useRoute()
const moldura = computed(() => (rota.meta.admin ? LayoutAdmin : LayoutLoja))
</script>

<template>
  <component :is="moldura">
    <RouterView />
  </component>
  <!-- Fora da moldura: vale para a loja e para a gestão. -->
  <PerguntaDeIdade />
</template>
