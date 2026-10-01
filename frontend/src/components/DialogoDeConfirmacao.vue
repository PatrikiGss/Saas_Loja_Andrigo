<script setup lang="ts">
/**
 * Confirmação de uma ação que não dá para desfazer — ou de uma pergunta que
 * precisa de resposta.
 *
 * Usa o `<dialog>` do navegador em vez de uma sobreposição própria: foco
 * preso dentro da caixa, Escape fechando e leitura de diálogo pelo leitor de
 * tela vêm prontos, e nenhum deles é simples de reescrever direito.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import BotaoBase from './BotaoBase.vue'

const props = withDefaults(
  defineProps<{
    aberto: boolean
    titulo: string
    descricao?: string
    /** O que o botão faz, escrito como a ação: 'Limpar carrinho'. */
    confirmar?: string
    /**
     * O botão de desistir. 'Cancelar' serve quase sempre; num diálogo que
     * cancela alguma coisa, ele ficaria ao lado de 'Cancelar pedido' e os dois
     * pareceriam a mesma ação.
     */
    desistir?: string
    processando?: boolean
    /**
     * Sem resposta não há como seguir: Escape não fecha, e o foco abre na
     * pergunta, e não num botão, para um Enter distraído não responder por
     * ninguém. É o caso da pergunta de idade.
     */
    exigeResposta?: boolean
  }>(),
  { confirmar: 'Confirmar', desistir: 'Cancelar' },
)

const emit = defineEmits<{ confirmar: []; cancelar: [] }>()

const caixa = ref<HTMLDialogElement | null>(null)
const pergunta = ref<HTMLHeadingElement | null>(null)
const idDoTitulo = useId()
const idDaDescricao = useId()

async function acompanhar(aberto: boolean): Promise<void> {
  const elemento = caixa.value
  if (!elemento) {
    return
  }
  if (aberto && !elemento.open) {
    elemento.showModal()
    if (props.exigeResposta) {
      await nextTick()
      pergunta.value?.focus()
    }
  } else if (!aberto && elemento.open) {
    elemento.close()
  }
}

// Quem já monta aberto — como a pergunta de idade, pendente desde a partida —
// precisa do `<dialog>`, que só existe depois da montagem: o estado inicial
// vem daqui, e as mudanças, do observador.
onMounted(() => void acompanhar(props.aberto))
watch(() => props.aberto, acompanhar, { flush: 'post' })

/** Escape e clique fora fecham por conta do navegador; o estado precisa saber. */
function aoFechar(): void {
  if (props.aberto && !props.processando && !props.exigeResposta) {
    emit('cancelar')
  }
}

onBeforeUnmount(() => caixa.value?.close())
</script>

<template>
  <dialog
    ref="caixa"
    class="dialogo"
    :class="{ 'dialogo--exige-resposta': exigeResposta }"
    :aria-labelledby="idDoTitulo"
    :aria-describedby="descricao ? idDaDescricao : undefined"
    @close="aoFechar"
    @cancel.prevent="aoFechar"
  >
    <h2 :id="idDoTitulo" ref="pergunta" class="dialogo__titulo" tabindex="-1">{{ titulo }}</h2>
    <p v-if="descricao" :id="idDaDescricao" class="dialogo__descricao">{{ descricao }}</p>

    <div class="dialogo__acoes">
      <BotaoBase variante="secundario" :desabilitado="processando" @click="emit('cancelar')">
        {{ desistir }}
      </BotaoBase>
      <BotaoBase :carregando="processando" @click="emit('confirmar')">
        {{ confirmar }}
      </BotaoBase>
    </div>
  </dialog>
</template>

<style scoped>
.dialogo {
  width: min(24rem, calc(100vw - 2rem));
  /* O `* { margin: 0 }` do reset apaga o `margin: auto` que o navegador usa
     para centralizar um dialog modal, e a caixa ia parar no canto da tela. */
  margin: auto;
  padding: var(--e5);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-superficie);
  color: var(--tinta);
}

.dialogo::backdrop {
  background: rgb(25 29 34 / 0.45);
}

/* Mais escuro: aqui a página atrás ainda não foi liberada para quem olha. */
.dialogo--exige-resposta::backdrop {
  background: rgb(25 29 34 / 0.8);
}

.dialogo__titulo {
  font-size: var(--texto-lg);
}

.dialogo__titulo:focus {
  outline: none;
}

.dialogo__descricao {
  margin-top: var(--e3);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.dialogo__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--e2);
  margin-top: var(--e5);
}
</style>
