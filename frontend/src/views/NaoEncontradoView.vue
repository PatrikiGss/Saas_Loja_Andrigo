<script setup lang="ts">
/** Rota que não existe. Diz o que houve e devolve a pessoa para a loja. */
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="perdido">
    <h1 class="perdido__titulo">Esta página não existe.</h1>
    <p class="perdido__texto">O endereço pode ter mudado ou o link está incompleto.</p>
    <RouterLink class="perdido__volta" to="/">Voltar para a loja</RouterLink>
  </section>
</template>

<style scoped>
.perdido {
  padding-block: var(--e7);
}

.perdido__titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
}

.perdido__texto {
  margin-top: var(--e3);
  color: var(--tinta-media);
}

.perdido__volta {
  display: inline-block;
  margin-top: var(--e5);
  font-weight: 600;
}
</style>
