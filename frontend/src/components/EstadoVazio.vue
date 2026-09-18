<script setup lang="ts">
/**
 * Tela sem conteúdo.
 *
 * Vazio é convite para agir, então o slot de ação existe e a descrição diz o
 * próximo passo em vez de lamentar a ausência.
 */
defineProps<{ titulo: string; descricao?: string }>()
</script>

<template>
  <div class="vazio">
    <h2 class="vazio__titulo">{{ titulo }}</h2>
    <p v-if="descricao" class="vazio__descricao">{{ descricao }}</p>
    <div v-if="$slots.acao" class="vazio__acao"><slot name="acao" /></div>
  </div>
</template>

<style scoped>
.vazio {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--e3);
  padding: var(--e7) 0;
  border-top: 1px solid var(--linha);
}

.vazio__titulo {
  font-size: var(--texto-lg);
}

.vazio__descricao {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
  margin: 0;
}

.vazio__acao {
  margin-top: var(--e2);
}
</style>
