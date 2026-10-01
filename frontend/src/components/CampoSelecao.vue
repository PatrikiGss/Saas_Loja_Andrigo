<script setup lang="ts" generic="Valor extends string">
/**
 * Campo de seleção. Rótulo, dica, erro e a ligação de acessibilidade entre
 * eles vêm da `MolduraDoCampo`; aqui mora só o `<select>`.
 *
 * As opções vêm pelo slot, porque cada lista tem o próprio texto. A primeira
 * opção, vazia e desabilitada, é o convite a escolher: sem ela, o navegador
 * mostraria a primeira opção de verdade como se já tivesse sido escolhida.
 */
import MolduraDoCampo from './MolduraDoCampo.vue'

withDefaults(
  defineProps<{
    rotulo: string
    dica?: string
    erro?: string
    obrigatorio?: boolean
    desabilitado?: boolean
    convite?: string
  }>(),
  {
    obrigatorio: false,
    desabilitado: false,
    convite: 'Escolha',
  },
)

const valor = defineModel<Valor>({ required: true })
</script>

<template>
  <MolduraDoCampo
    v-slot="controle"
    :rotulo="rotulo"
    :dica="dica"
    :erro="erro"
    :obrigatorio="obrigatorio"
  >
    <select v-bind="controle" v-model="valor" :required="obrigatorio" :disabled="desabilitado">
      <option value="" disabled>{{ convite }}</option>
      <slot />
    </select>
  </MolduraDoCampo>
</template>
