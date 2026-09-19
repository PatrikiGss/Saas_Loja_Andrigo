<script setup lang="ts">
/**
 * Uma linha do carrinho.
 *
 * A quantidade muda na hora na tela, porque é o que a pessoa digitou. O
 * subtotal não: ele é dinheiro, vem do servidor, e fica marcado como em
 * atualização até a resposta chegar. Mostrar um subtotal calculado aqui
 * seria adivinhar o que só o backend decide.
 */
import { onBeforeUnmount, ref, watch } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import { moeda } from '@/utils/formato'
import { QUANTIDADE_MAXIMA, type ItemCarrinho } from '../types'

const props = defineProps<{ item: ItemCarrinho; salvando?: boolean }>()

const emit = defineEmits<{
  alterarQuantidade: [item: number, quantidade: number]
  remover: [item: number]
}>()

/** Espera antes de mandar, para quem clica no mais várias vezes seguidas. */
const ESPERA_MS = 400

const quantidade = ref(props.item.quantidade)
let temporizador: ReturnType<typeof setTimeout> | undefined
const pendente = ref(false)

// A quantidade da API manda: se o servidor recusou a alteração, a linha volta
// para o valor que ele guarda.
watch(
  () => props.item.quantidade,
  (valor) => {
    if (!pendente.value) {
      quantidade.value = valor
    }
  },
)

function dentroDaFaixa(valor: number): number {
  return Math.min(Math.max(Math.trunc(valor), 1), QUANTIDADE_MAXIMA)
}

function definir(valor: number): void {
  const nova = dentroDaFaixa(valor)
  quantidade.value = nova

  // Sempre cancela o envio anterior: sem isto, aumentar e voltar deixaria o
  // primeiro agendamento de pé e mandaria a quantidade que a pessoa desfez.
  clearTimeout(temporizador)

  if (nova === props.item.quantidade) {
    pendente.value = false
    return
  }

  pendente.value = true
  temporizador = setTimeout(() => {
    pendente.value = false
    emit('alterarQuantidade', props.item.id, nova)
  }, ESPERA_MS)
}

/**
 * Campo limpo ou preenchido com o que não é número volta para a quantidade do
 * servidor. Virar 1 em silêncio seria alterar o pedido sem ninguém pedir.
 */
function aoDigitar(bruto: string): void {
  const valor = Number(bruto)
  if (bruto.trim() === '' || !Number.isFinite(valor)) {
    quantidade.value = props.item.quantidade
    clearTimeout(temporizador)
    pendente.value = false
    return
  }
  definir(valor)
}

onBeforeUnmount(() => clearTimeout(temporizador))
</script>

<template>
  <div class="linha" :class="{ 'linha--indisponivel': !item.produto.disponivel }">
    <div class="linha__produto">
      <h2 class="linha__nome">{{ item.produto.nome }}</h2>
      <p class="linha__sku numerico">{{ item.produto.sku }}</p>
      <p v-if="!item.produto.disponivel" class="linha__aviso">
        Indisponível. Remova para fechar o pedido.
      </p>
    </div>

    <div class="linha__quantidade">
      <BotaoBase
        variante="secundario"
        :desabilitado="quantidade <= 1 || salvando"
        @click="definir(quantidade - 1)"
      >
        <span aria-hidden="true">−</span>
        <span class="apenas-leitor">Diminuir a quantidade de {{ item.produto.nome }}</span>
      </BotaoBase>

      <label>
        <span class="apenas-leitor">Quantidade de {{ item.produto.nome }}</span>
        <input
          class="linha__campo numerico"
          type="number"
          inputmode="numeric"
          min="1"
          :max="QUANTIDADE_MAXIMA"
          :value="quantidade"
          :disabled="salvando"
          @change="aoDigitar(($event.target as HTMLInputElement).value)"
        />
      </label>

      <BotaoBase
        variante="secundario"
        :desabilitado="quantidade >= QUANTIDADE_MAXIMA || salvando"
        @click="definir(quantidade + 1)"
      >
        <span aria-hidden="true">+</span>
        <span class="apenas-leitor">Aumentar a quantidade de {{ item.produto.nome }}</span>
      </BotaoBase>
    </div>

    <p class="linha__subtotal numerico" :aria-busy="salvando || undefined">
      {{ moeda(item.subtotal) }}
    </p>

    <BotaoBase variante="discreto" :desabilitado="salvando" @click="emit('remover', item.id)">
      Remover
    </BotaoBase>
  </div>
</template>

<style scoped>
.linha {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: var(--e4);
  padding: var(--e4) 0;
  border-bottom: 1px solid var(--linha);
}

/* Recua, mas continua legível: o aviso em texto é que carrega a informação. */
.linha--indisponivel .linha__nome,
.linha--indisponivel .linha__subtotal {
  color: var(--tinta-media);
}

.linha__nome {
  font-size: var(--texto-base);
  font-weight: 700;
  font-stretch: 92%;
}

.linha__sku {
  margin-top: var(--e1);
  font-size: var(--texto-xs);
  color: var(--tinta-fraca);
}

.linha__aviso {
  margin-top: var(--e1);
  font-size: var(--texto-xs);
  font-weight: 600;
  color: var(--alerta);
}

.linha__quantidade {
  display: flex;
  align-items: center;
  gap: var(--e2);
}

.linha__quantidade :deep(.botao) {
  min-width: 2.5rem;
  padding: 0 var(--e2);
}

.linha__campo {
  width: 3.5rem;
  min-height: 2.75rem;
  padding: 0 var(--e2);
  text-align: center;
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
}

.linha__subtotal {
  min-width: 6rem;
  text-align: right;
  font-weight: 600;
}

.linha__subtotal[aria-busy='true'] {
  opacity: 0.45;
}

@media (max-width: 40rem) {
  .linha {
    grid-template-columns: 1fr auto;
    row-gap: var(--e3);
  }

  .linha__produto {
    grid-column: 1 / -1;
  }

  .linha__subtotal {
    text-align: left;
    min-width: 0;
  }
}
</style>
