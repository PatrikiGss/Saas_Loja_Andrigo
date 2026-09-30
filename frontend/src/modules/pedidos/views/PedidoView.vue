<script setup lang="ts">
/**
 * Um pedido.
 *
 * Pedido de outra conta não existe na consulta do backend e responde 404 —
 * o mesmo que um número inventado. A tela trata os dois igual, de propósito:
 * distinguir 'não é seu' de 'não existe' contaria o que não deve ser contado.
 *
 * O botão de cancelar aparece quando o servidor diz `pode_cancelar`. Se o
 * pedido tiver sido pago entre a leitura e o clique, a recusa dele aparece
 * aqui mesmo.
 */
import { ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import { useRequisicao } from '@/composables/useRequisicao'
import { dataHora } from '@/utils/formato'
import AcompanhamentoDoPedido from '../components/AcompanhamentoDoPedido.vue'
import AvisoDePagamento from '../components/AvisoDePagamento.vue'
import EntregaDoPedido from '../components/EntregaDoPedido.vue'
import ItensDoPedido from '../components/ItensDoPedido.vue'
import ValoresDoPedido from '../components/ValoresDoPedido.vue'
import { buscarPedido, cancelarPedido } from '../services/pedidos'

const rota = useRoute()

const {
  dados: pedido,
  carregando,
  erro,
  executar,
} = useRequisicao(() => buscarPedido(String(rota.params.numero)))

watch(
  () => rota.params.numero,
  () => void executar(),
)

const confirmandoCancelamento = ref(false)

const {
  enviando: cancelando,
  erro: erroAoCancelar,
  submeter: cancelar,
} = useFormulario(async () => {
  try {
    pedido.value = await cancelarPedido(String(rota.params.numero))
  } finally {
    confirmandoCancelamento.value = false
  }
})
</script>

<template>
  <CarregandoIndicador v-if="carregando" texto="Carregando o pedido" />

  <div v-else-if="erro" class="falha">
    <MensagemDeErro :erro="erro" @repetir="executar" />
    <p><RouterLink to="/pedidos">Voltar para os pedidos</RouterLink></p>
  </div>

  <article v-else-if="pedido" class="pedido">
    <header class="cabecalho">
      <RouterLink to="/pedidos" class="cabecalho__voltar">Meus pedidos</RouterLink>
      <h1 class="cabecalho__numero numerico">{{ pedido.numero }}</h1>
      <p class="cabecalho__data">Feito em {{ dataHora(pedido.criado_em) }}</p>
      <p v-if="pedido.pago_em" class="cabecalho__data">Pago em {{ dataHora(pedido.pago_em) }}</p>
    </header>

    <div class="colunas">
      <section class="coluna">
        <h2 class="coluna__nome">Acompanhamento</h2>
        <AcompanhamentoDoPedido :status="pedido.status" />
        <AvisoDePagamento :pedido="pedido" class="pagamento" />
        <MensagemDeErro
          v-if="erroAoCancelar"
          :erro="erroAoCancelar"
          :detalhe="erroAoCancelar.campos.status"
          sem-repetir
          class="cancelamento"
        />
        <BotaoBase
          v-if="pedido.pode_cancelar"
          variante="secundario"
          class="cancelamento"
          @click="confirmandoCancelamento = true"
        >
          Cancelar pedido
        </BotaoBase>
      </section>

      <section class="coluna">
        <h2 class="coluna__nome">Entrega</h2>
        <EntregaDoPedido :pedido="pedido" />
      </section>
    </div>

    <section class="secao">
      <h2 class="coluna__nome">Itens</h2>
      <ItensDoPedido :itens="pedido.itens" />
    </section>

    <section class="secao">
      <h2 class="apenas-leitor">Valores</h2>
      <ValoresDoPedido :pedido="pedido" />
    </section>

    <DialogoDeConfirmacao
      :aberto="confirmandoCancelamento"
      titulo="Cancelar este pedido?"
      descricao="Ele sai do fluxo e nada é cobrado por ele. Não dá para desfazer."
      confirmar="Cancelar pedido"
      desistir="Manter pedido"
      :processando="cancelando"
      @confirmar="cancelar"
      @cancelar="confirmandoCancelamento = false"
    />
  </article>
</template>

<style scoped>
.cabecalho {
  margin-bottom: var(--e6);
}

.cabecalho__voltar {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.cabecalho__numero {
  margin-top: var(--e2);
  font-size: var(--texto-2xl);
  font-stretch: 85%;
}

.cabecalho__data {
  margin-top: var(--e1);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.colunas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--e6);
  max-width: 48rem;
}

.coluna__nome {
  font-size: var(--texto-sm);
  font-weight: 700;
  padding-bottom: var(--e2);
  margin-bottom: var(--e3);
  border-bottom: 1px solid var(--linha);
}

.pagamento {
  margin-top: var(--e5);
}

.cancelamento {
  margin-top: var(--e4);
}

.secao {
  margin-top: var(--e7);
  max-width: 34rem;
}
</style>
