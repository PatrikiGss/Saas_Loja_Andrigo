<script setup lang="ts">
/**
 * Marca da categoria: um quadrado do matiz e o nome em tinta.
 *
 * O nome não é escrito na cor de propósito. Texto colorido exigiria uma
 * variante escura para cada um dos cinco matizes só para passar em contraste,
 * e o quadrado já carrega o código de cor sem esse custo.
 */
import { corDaCategoria } from '../categorias'

defineProps<{ slug: string; nome: string }>()
</script>

<template>
  <span class="selo">
    <span class="selo__cor" :style="{ background: corDaCategoria(slug) }" aria-hidden="true" />
    {{ nome }}
  </span>
</template>

<style scoped>
.selo {
  display: inline-flex;
  align-items: center;
  gap: var(--e2);
  font-size: var(--texto-xs);
  font-weight: 600;
  color: var(--tinta-media);
}

.selo__cor {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: var(--raio-bloco);
  flex: none;
}
</style>
