<script setup lang="ts">
/**
 * Campo de texto. Rótulo, dica, erro e a ligação de acessibilidade entre eles
 * vêm da `MolduraDoCampo`; aqui mora só a entrada.
 */
import MolduraDoCampo from './MolduraDoCampo.vue'

withDefaults(
  defineProps<{
    rotulo: string
    tipo?: 'text' | 'email' | 'password' | 'tel' | 'number'
    dica?: string
    erro?: string
    obrigatorio?: boolean
    desabilitado?: boolean
    autocomplete?: string
    placeholder?: string
    inputmode?: 'text' | 'numeric' | 'tel' | 'email'
    maxlength?: number
  }>(),
  {
    tipo: 'text',
    obrigatorio: false,
    desabilitado: false,
  },
)

const valor = defineModel<string>({ required: true })
</script>

<template>
  <MolduraDoCampo
    v-slot="controle"
    :rotulo="rotulo"
    :dica="dica"
    :erro="erro"
    :obrigatorio="obrigatorio"
  >
    <input
      v-bind="controle"
      v-model="valor"
      :type="tipo"
      :required="obrigatorio"
      :disabled="desabilitado"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :maxlength="maxlength"
    />
  </MolduraDoCampo>
</template>
