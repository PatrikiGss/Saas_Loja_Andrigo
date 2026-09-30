<script setup lang="ts">
/**
 * Confirmação de uma ação que não dá para desfazer.
 *
 * Usa o `<dialog>` do navegador em vez de uma sobreposição própria: foco
 * preso dentro da caixa, Escape fechando e leitura de diálogo pelo leitor de
 * tela vêm prontos, e nenhum deles é simples de reescrever direito.
 */
import { onBeforeUnmount, ref, watch } from 'vue'

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
  }>(),
  { confirmar: 'Confirmar', desistir: 'Cancelar' },
)

const emit = defineEmits<{ confirmar: []; cancelar: [] }>()

const caixa = ref<HTMLDialogElement | null>(null)

watch(
  () => props.aberto,
  (aberto) => {
    const elemento = caixa.value
    if (!elemento) {
      return
    }
    if (aberto && !elemento.open) {
      elemento.showModal()
    } else if (!aberto && elemento.open) {
      elemento.close()
    }
  },
)

/** Escape e clique fora fecham por conta do navegador; o estado precisa saber. */
function aoFechar(): void {
  if (props.aberto && !props.processando) {
    emit('cancelar')
  }
}

onBeforeUnmount(() => caixa.value?.close())
</script>

<template>
  <dialog ref="caixa" class="dialogo" @close="aoFechar" @cancel.prevent="aoFechar">
    <h2 class="dialogo__titulo">{{ titulo }}</h2>
    <p v-if="descricao" class="dialogo__descricao">{{ descricao }}</p>

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

.dialogo__titulo {
  font-size: var(--texto-lg);
}

.dialogo__descricao {
  margin-top: var(--e3);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.dialogo__acoes {
  display: flex;
  justify-content: flex-end;
  gap: var(--e2);
  margin-top: var(--e5);
}
</style>
