<script setup lang="ts">
/**
 * Confirmação de que algo deu certo.
 *
 * Sem cor própria: verde disputaria com o matiz da categoria essência, e a
 * paleta da loja reserva cor para significar categoria. Aqui basta tinta e
 * uma barra que separa do resto.
 */
defineProps<{ titulo: string; descricao?: string }>()
</script>

<template>
  <div class="aviso" role="status">
    <h2 class="aviso__titulo">{{ titulo }}</h2>
    <p v-if="descricao" class="aviso__descricao">{{ descricao }}</p>
    <div v-if="$slots.default" class="aviso__acao"><slot /></div>
  </div>
</template>

<style scoped>
.aviso {
  padding-left: var(--e4);
  border-left: 3px solid var(--tinta);
}

.aviso__titulo {
  font-size: var(--texto-md);
}

.aviso__descricao {
  margin-top: var(--e2);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.aviso__acao {
  margin-top: var(--e4);
}
</style>
