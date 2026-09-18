<script setup lang="ts">
/**
 * Botão da loja.
 *
 * `carregando` desabilita o próprio botão: é assim que o duplo envio de
 * formulário é impedido, sem depender de cada tela lembrar de fazer isso.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario' | 'discreto'
    tipo?: 'button' | 'submit'
    carregando?: boolean
    desabilitado?: boolean
    larguraTotal?: boolean
  }>(),
  {
    variante: 'primario',
    tipo: 'button',
    carregando: false,
    desabilitado: false,
    larguraTotal: false,
  },
)

const bloqueado = computed(() => props.desabilitado || props.carregando)
</script>

<template>
  <button
    :type="tipo"
    :class="['botao', `botao--${variante}`, { 'botao--largo': larguraTotal }]"
    :disabled="bloqueado"
    :aria-busy="carregando || undefined"
  >
    <span v-if="carregando" class="botao__giro" aria-hidden="true" />
    <span class="botao__texto"><slot /></span>
  </button>
</template>

<style scoped>
.botao {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--e2);
  min-height: 2.75rem;
  padding: 0 var(--e5);
  border: 1px solid transparent;
  border-radius: var(--raio-controle);
  font-size: var(--texto-sm);
  font-weight: 600;
  font-stretch: 105%;
  letter-spacing: 0.005em;
  cursor: pointer;
  transition:
    background-color var(--transicao),
    border-color var(--transicao),
    color var(--transicao);
}

.botao:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.botao--largo {
  width: 100%;
}

.botao--primario {
  background: var(--tinta);
  color: var(--papel-alto);
}

.botao--primario:hover:not(:disabled) {
  background: #000;
}

.botao--secundario {
  background: var(--papel-alto);
  border-color: var(--linha-forte);
  color: var(--tinta);
}

.botao--secundario:hover:not(:disabled) {
  border-color: var(--tinta);
}

.botao--discreto {
  background: transparent;
  color: var(--tinta-media);
  padding: 0 var(--e2);
}

.botao--discreto:hover:not(:disabled) {
  color: var(--tinta);
}

.botao__giro {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: girar 640ms linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(1turn);
  }
}
</style>
