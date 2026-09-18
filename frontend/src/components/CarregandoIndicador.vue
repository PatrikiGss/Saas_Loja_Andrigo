<script setup lang="ts">
/**
 * Espera visível.
 *
 * O texto não é enfeite: é o que o leitor de tela anuncia, e é o que evita a
 * tela em branco enquanto a API responde.
 */
withDefaults(defineProps<{ texto?: string }>(), { texto: 'Carregando' })
</script>

<template>
  <div class="carregando" role="status">
    <span class="carregando__barra" aria-hidden="true" />
    <span class="carregando__texto">{{ texto }}</span>
  </div>
</template>

<style scoped>
.carregando {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  padding: var(--e7) 0;
}

.carregando__barra {
  width: 100%;
  max-width: 12rem;
  height: 2px;
  background: var(--linha);
  overflow: hidden;
  position: relative;
}

.carregando__barra::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 40%;
  background: var(--tinta);
  animation: percorrer 1100ms ease-in-out infinite;
}

.carregando__texto {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

@keyframes percorrer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}

/* Sem movimento, a barra fica preenchida: continua sendo sinal de espera. */
@media (prefers-reduced-motion: reduce) {
  .carregando__barra::after {
    animation: none;
    width: 100%;
    opacity: 0.35;
  }
}
</style>
