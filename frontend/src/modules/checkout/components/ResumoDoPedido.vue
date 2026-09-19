<script setup lang="ts">
/**
 * Conferência antes de fechar.
 *
 * O total desta tela é soma de apresentação: subtotal do carrinho mais o
 * preço da cotação, ambos vindos do servidor. O valor que vale é o do pedido,
 * que só existe depois do fechamento — e é ele que a confirmação mostra.
 */
import { computed } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import type { ErroDaApi } from '@/services/erros'
import type { ItemCarrinho } from '@/modules/carrinho/types'
import type { Endereco } from '@/modules/enderecos/types'
import { cep as formatarCep, moeda, somarDinheiro } from '@/utils/formato'
import type { OpcaoFrete } from '../types'

const props = defineProps<{
  itens: ItemCarrinho[]
  subtotal: string
  endereco: Endereco
  frete: OpcaoFrete
  fechando: boolean
  erro: ErroDaApi | null
}>()

const emit = defineEmits<{ fechar: []; repetir: [] }>()

const totalEstimado = computed(() => somarDinheiro(props.subtotal, props.frete.preco))

/** Recusas do fechamento que valem mais que a mensagem genérica. */
const recusa = computed(
  () =>
    props.erro?.campos.carrinho ??
    props.erro?.campos.itens ??
    props.erro?.campos.pedido ??
    props.erro?.campos.servico,
)
</script>

<template>
  <section>
    <h2 class="titulo">Confira antes de fechar</h2>

    <div class="blocos">
      <div class="bloco">
        <h3 class="bloco__nome">Itens</h3>
        <ul class="itens">
          <li v-for="item in itens" :key="item.id" class="item">
            <span class="item__nome">
              <span class="numerico">{{ item.quantidade }}</span> × {{ item.produto.nome }}
            </span>
            <span class="item__valor numerico">{{ moeda(item.subtotal) }}</span>
          </li>
        </ul>
      </div>

      <div class="bloco">
        <h3 class="bloco__nome">Entrega</h3>
        <p class="bloco__texto">
          {{ endereco.logradouro }}, {{ endereco.numero }}<br />
          <template v-if="endereco.complemento">{{ endereco.complemento }}<br /></template>
          {{ endereco.bairro }} — {{ endereco.cidade }}/{{ endereco.uf }}<br />
          <span class="numerico">CEP {{ formatarCep(endereco.cep) }}</span>
        </p>
        <p class="bloco__texto">
          {{ frete.nome }}, em até
          <span class="numerico">{{ frete.prazo_em_dias }}</span>
          {{ frete.prazo_em_dias === 1 ? 'dia útil' : 'dias úteis' }}
        </p>
      </div>
    </div>

    <dl class="valores">
      <div class="valores__linha">
        <dt>Subtotal</dt>
        <dd class="numerico">{{ moeda(subtotal) }}</dd>
      </div>
      <div class="valores__linha">
        <dt>Frete</dt>
        <dd class="numerico">{{ moeda(frete.preco) }}</dd>
      </div>
      <div class="valores__linha valores__linha--total">
        <dt>Total</dt>
        <dd class="numerico">{{ moeda(totalEstimado) }}</dd>
      </div>
    </dl>

    <MensagemDeErro v-if="erro" :erro="erro" :detalhe="recusa" sem-repetir class="recusa" />

    <BotaoBase :carregando="fechando" @click="emit('fechar')">Fechar pedido</BotaoBase>

    <p class="aviso">
      O pagamento ainda não está disponível. O pedido fica registrado aguardando pagamento.
    </p>
  </section>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-lg);
  margin-bottom: var(--e4);
}

.blocos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--e5);
  max-width: 44rem;
}

.bloco__nome {
  font-size: var(--texto-sm);
  font-weight: 700;
  padding-bottom: var(--e2);
  border-bottom: 1px solid var(--linha);
}

.bloco__texto {
  margin-top: var(--e3);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
  line-height: 1.5;
}

.itens {
  list-style: none;
  padding: 0;
  margin-top: var(--e2);
}

.item {
  display: flex;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e2) 0;
  font-size: var(--texto-sm);
}

.item__valor {
  font-weight: 600;
  white-space: nowrap;
}

.valores {
  max-width: 22rem;
  margin: var(--e6) 0 var(--e5);
  border-top: 1px solid var(--linha);
}

.valores__linha {
  display: flex;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e2) 0;
  font-size: var(--texto-sm);
}

.valores__linha dd {
  margin: 0;
  font-weight: 600;
}

.valores__linha--total {
  padding-top: var(--e3);
  border-top: 1px solid var(--linha);
  font-size: var(--texto-md);
  font-weight: 700;
}

.recusa {
  margin-bottom: var(--e4);
}

.aviso {
  margin-top: var(--e4);
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}
</style>
