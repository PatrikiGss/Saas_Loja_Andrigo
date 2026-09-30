<script setup lang="ts">
/**
 * A pergunta de idade, na entrada do site e antes do carrinho.
 *
 * `<dialog>` modal do navegador, como o de confirmação: o resto da página
 * fica inerte até a resposta. Escape não fecha — sem resposta não há como
 * seguir. O foco abre na pergunta, e não num botão, para um Enter distraído
 * não responder por ninguém.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import { IDADE_MINIMA, NOME_DA_LOJA } from '@/app/config'
import { useIdade, type Momento } from '../stores/idade'

const idade = useIdade()
const caixa = ref<HTMLDialogElement | null>(null)
const titulo = ref<HTMLHeadingElement | null>(null)

const motivo = computed(() => {
  const regra = `A ${NOME_DA_LOJA} vende produtos com nicotina, e a venda é proibida para menores de ${IDADE_MINIMA} anos.`
  return idade.pergunta === 'compra' ? `Antes do carrinho, confirmamos de novo. ${regra}` : regra
})

async function acompanhar(pergunta: Momento | null): Promise<void> {
  const elemento = caixa.value
  if (!elemento) {
    return
  }
  if (pergunta && !elemento.open) {
    elemento.showModal()
    await nextTick()
    titulo.value?.focus()
  } else if (!pergunta && elemento.open) {
    elemento.close()
  }
}

// A pergunta da entrada já está pendente quando o componente monta: o
// `<dialog>` só existe depois disso, então o estado inicial vem daqui, e as
// mudanças, do observador.
onMounted(() => void acompanhar(idade.pergunta))
watch(() => idade.pergunta, acompanhar, { flush: 'post' })
</script>

<template>
  <dialog
    ref="caixa"
    class="idade"
    aria-labelledby="idade-pergunta"
    aria-describedby="idade-motivo"
    @cancel.prevent
  >
    <h2 id="idade-pergunta" ref="titulo" class="idade__pergunta" tabindex="-1">
      Você tem {{ IDADE_MINIMA }} anos ou mais?
    </h2>
    <p id="idade-motivo" class="idade__motivo">{{ motivo }}</p>

    <div class="idade__acoes">
      <BotaoBase variante="secundario" @click="idade.responder(false)">Não</BotaoBase>
      <BotaoBase @click="idade.responder(true)">Sim, tenho {{ IDADE_MINIMA }} ou mais</BotaoBase>
    </div>
  </dialog>
</template>

<style scoped>
.idade {
  width: min(26rem, calc(100vw - 2rem));
  /* O `* { margin: 0 }` do reset apaga o `margin: auto` que o navegador usa
     para centralizar um dialog modal. */
  margin: auto;
  padding: var(--e5);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-superficie);
  color: var(--tinta);
}

/* Mais escuro que o do diálogo de confirmação: aqui a página atrás ainda não
   foi liberada para quem está olhando. */
.idade::backdrop {
  background: rgb(25 29 34 / 0.8);
}

.idade__pergunta {
  font-size: var(--texto-xl);
  font-stretch: 85%;
}

.idade__pergunta:focus {
  outline: none;
}

.idade__motivo {
  margin-top: var(--e3);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.idade__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--e2);
  margin-top: var(--e5);
}
</style>
