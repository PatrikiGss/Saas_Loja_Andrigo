<script setup lang="ts">
/**
 * Escolha do serviço de entrega.
 *
 * Preço e prazo vêm da cotação do servidor. O que vai no fechamento é só o
 * identificador do serviço — o backend recalcula o valor a partir dele, então
 * mexer nesta tela não muda o que se paga.
 */
import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import type { ErroDaApi } from '@/services/erros'
import type { ServicoFrete } from '@/modules/pedidos/types'
import { moeda } from '@/utils/formato'
import type { OpcaoFrete } from '../types'
import OpcaoEmCartao from './OpcaoEmCartao.vue'

defineProps<{
  opcoes: OpcaoFrete[]
  selecionado: ServicoFrete | null
  carregando: boolean
  erro: ErroDaApi | null
}>()

const emit = defineEmits<{
  escolher: [servico: ServicoFrete]
  continuar: []
  repetir: []
}>()

function prazo(dias: number): string {
  return dias === 1 ? '1 dia útil' : `${dias} dias úteis`
}
</script>

<template>
  <section>
    <h2 class="titulo">Como você quer receber?</h2>

    <CarregandoIndicador v-if="carregando" texto="Calculando o frete" />

    <MensagemDeErro
      v-else-if="erro"
      :erro="erro"
      :detalhe="erro.campos.endereco"
      @repetir="emit('repetir')"
    />

    <div v-else class="lista">
      <OpcaoEmCartao
        v-for="opcao in opcoes"
        :key="opcao.servico"
        nome="frete"
        :valor="opcao.servico"
        :escolhida="selecionado === opcao.servico"
        @escolher="emit('escolher', opcao.servico)"
      >
        <span class="opcao__texto">
          <span class="opcao__nome">{{ opcao.nome }}</span>
          <span class="opcao__prazo">{{ prazo(opcao.prazo_em_dias) }}</span>
        </span>
        <span class="opcao__preco numerico">{{ moeda(opcao.preco) }}</span>
      </OpcaoEmCartao>

      <div class="acoes">
        <BotaoBase :desabilitado="selecionado === null" @click="emit('continuar')">
          Continuar
        </BotaoBase>
      </div>
    </div>
  </section>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-lg);
  margin-bottom: var(--e4);
}

.lista {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  max-width: 34rem;
}

.opcao__texto {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  flex: 1;
}

.opcao__nome {
  font-weight: 700;
  font-size: var(--texto-sm);
}

.opcao__prazo {
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.opcao__preco {
  font-weight: 700;
}

.acoes {
  margin-top: var(--e2);
}
</style>
