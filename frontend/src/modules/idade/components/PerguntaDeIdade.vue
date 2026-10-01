<script setup lang="ts">
/**
 * A pergunta de idade, na entrada do site e antes do carrinho.
 *
 * É o diálogo de confirmação no modo que exige resposta: Escape não fecha, e
 * o foco abre na pergunta. "Sim" libera; "Não" tira a pessoa do site.
 */
import { computed } from 'vue'

import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import { IDADE_MINIMA, NOME_DA_LOJA } from '@/app/config'
import { useIdade } from '../stores/idade'

const idade = useIdade()

const motivo = computed(() => {
  const regra = `A ${NOME_DA_LOJA} vende produtos com nicotina, e a venda é proibida para menores de ${IDADE_MINIMA} anos.`
  return idade.pergunta === 'compra' ? `Antes do carrinho, confirmamos de novo. ${regra}` : regra
})
</script>

<template>
  <DialogoDeConfirmacao
    :aberto="idade.pergunta !== null"
    :titulo="`Você tem ${IDADE_MINIMA} anos ou mais?`"
    :descricao="motivo"
    :confirmar="`Sim, tenho ${IDADE_MINIMA} ou mais`"
    desistir="Não"
    exige-resposta
    @confirmar="idade.responder(true)"
    @cancelar="idade.responder(false)"
  />
</template>
