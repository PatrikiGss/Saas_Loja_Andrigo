<script setup lang="ts">
/**
 * Uma opção de escolha única desenhada como cartão: o rótulo inteiro é
 * clicável, e o rádio de verdade continua lá dentro — teclado, leitor de tela
 * e agrupamento por `name` vêm do navegador.
 *
 * Os passos do fechamento escolhem assim o endereço e o frete; o conteúdo do
 * cartão vem pelo slot.
 */
defineProps<{
  /** Nome do grupo: só uma opção com o mesmo nome fica marcada. */
  nome: string
  valor: string | number
  escolhida: boolean
}>()

const emit = defineEmits<{ escolher: [] }>()
</script>

<template>
  <label class="opcao" :class="{ 'opcao--escolhida': escolhida }">
    <input
      type="radio"
      class="opcao__radio"
      :name="nome"
      :value="valor"
      :checked="escolhida"
      @change="emit('escolher')"
    />
    <slot />
  </label>
</template>

<style scoped>
.opcao {
  display: flex;
  align-items: flex-start;
  gap: var(--e3);
  padding: var(--e4);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-superficie);
  cursor: pointer;
}

.opcao--escolhida {
  border-color: var(--tinta);
  box-shadow: inset 0 0 0 1px var(--tinta);
}

/* Alinha o rádio com a primeira linha do texto. */
.opcao__radio {
  margin-top: 0.25rem;
  accent-color: var(--tinta);
}
</style>
