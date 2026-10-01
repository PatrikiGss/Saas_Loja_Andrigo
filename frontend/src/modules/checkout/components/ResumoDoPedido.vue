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
import EntregaDoPedido from '@/modules/pedidos/components/EntregaDoPedido.vue'
import ItensDoPedido from '@/modules/pedidos/components/ItensDoPedido.vue'
import ValoresDoPedido from '@/modules/pedidos/components/ValoresDoPedido.vue'
import type { ItemPedido } from '@/modules/pedidos/types'
import type { ErroDaApi } from '@/services/erros'
import type { ItemCarrinho } from '@/modules/carrinho/types'
import type { Endereco } from '@/modules/enderecos/types'
import { somarDinheiro } from '@/utils/formato'
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

/**
 * Os itens do carrinho no formato da linha de pedido, que é o que eles vão
 * virar: o resumo desenha com as mesmas peças da confirmação.
 */
const linhas = computed<ItemPedido[]>(() =>
  props.itens.map((item) => ({
    sku: item.produto.sku,
    nome: item.produto.nome,
    preco_unitario: item.produto.preco,
    quantidade: item.quantidade,
    subtotal: item.subtotal,
  })),
)

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
        <ItensDoPedido :itens="linhas" />
      </div>

      <div class="bloco">
        <h3 class="bloco__nome">Entrega</h3>
        <EntregaDoPedido
          :endereco="endereco"
          :servico="frete.nome"
          :prazo-em-dias="frete.prazo_em_dias"
        />
      </div>
    </div>

    <ValoresDoPedido
      class="resumo__valores"
      :valores="{ subtotal, frete: frete.preco, total: totalEstimado }"
    />

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

.resumo__valores {
  margin: var(--e6) 0 var(--e5);
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
