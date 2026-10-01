<script setup lang="ts">
/**
 * Campo de texto longo. Rótulo, dica, erro e a ligação de acessibilidade
 * entre eles vêm da `MolduraDoCampo`; aqui mora só o `<textarea>`.
 */
import MolduraDoCampo from './MolduraDoCampo.vue'

withDefaults(
  defineProps<{
    rotulo: string
    dica?: string
    erro?: string
    obrigatorio?: boolean
    desabilitado?: boolean
    maxlength?: number
    linhas?: number
  }>(),
  {
    obrigatorio: false,
    desabilitado: false,
    linhas: 4,
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
    <textarea
      v-bind="controle"
      v-model="valor"
      :rows="linhas"
      :required="obrigatorio"
      :disabled="desabilitado"
      :maxlength="maxlength"
    />
  </MolduraDoCampo>
</template>
