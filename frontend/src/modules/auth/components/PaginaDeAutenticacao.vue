<script setup lang="ts">
/**
 * Moldura das telas de conta.
 *
 * Coluna estreita e sem cor: a cor da loja pertence às categorias do
 * catálogo, e um formulário de senha não é categoria nenhuma.
 */
defineProps<{ titulo: string; descricao?: string }>()
</script>

<template>
  <section class="pagina">
    <h1 class="pagina__titulo">{{ titulo }}</h1>
    <p v-if="descricao" class="pagina__descricao">{{ descricao }}</p>

    <div class="pagina__corpo"><slot /></div>

    <div v-if="$slots.rodape" class="pagina__rodape"><slot name="rodape" /></div>
  </section>
</template>

<style scoped>
.pagina {
  max-width: 26rem;
}

.pagina__titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
}

.pagina__descricao {
  margin-top: var(--e3);
  color: var(--tinta-media);
}

.pagina__corpo {
  margin-top: var(--e6);
}

.pagina__rodape {
  margin-top: var(--e5);
  padding-top: var(--e5);
  border-top: 1px solid var(--linha);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.pagina__rodape :deep(a) {
  color: var(--tinta);
  font-weight: 600;
}
</style>
