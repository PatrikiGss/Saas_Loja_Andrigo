<script setup lang="ts">
/**
 * Fechamento do pedido: endereço, entrega, resumo.
 *
 * Os passos ficam nesta tela e não em rotas separadas de propósito: cada um
 * depende do anterior, e um link direto para o resumo cairia num estado sem
 * endereço nem frete escolhidos.
 *
 * O carrinho é condição de entrada. Vazio, ou com produto que saiu de venda,
 * não há o que fechar — e o backend recusaria de qualquer jeito.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useRequisicao } from '@/composables/useRequisicao'
import { deErro, type ErroDaApi } from '@/services/erros'
import { useCarrinho } from '@/modules/carrinho/stores/carrinho'
import { listarEnderecos } from '@/modules/enderecos/services/enderecos'
import type { Endereco } from '@/modules/enderecos/types'
import type { Pedido, ServicoFrete } from '@/modules/pedidos/types'
import PassosDoCheckout from '../components/PassosDoCheckout.vue'
import PedidoConfirmado from '../components/PedidoConfirmado.vue'
import ResumoDoPedido from '../components/ResumoDoPedido.vue'
import SelecaoDeEndereco from '../components/SelecaoDeEndereco.vue'
import SelecaoDeFrete from '../components/SelecaoDeFrete.vue'
import { cotarFrete, fecharPedido } from '../services/checkout'
import type { OpcaoFrete, Passo } from '../types'

const carrinho = useCarrinho()

const passo = ref<Passo>('endereco')
const enderecoEscolhido = ref<number | null>(null)
const servicoEscolhido = ref<ServicoFrete | null>(null)
const pedido = ref<Pedido | null>(null)

const enderecos = useRequisicao(listarEnderecos)

const opcoesDeFrete = ref<OpcaoFrete[]>([])
const cotando = ref(false)
const erroDaCotacao = ref<ErroDaApi | null>(null)

const fechando = ref(false)
const erroDoFechamento = ref<ErroDaApi | null>(null)

onMounted(() => {
  if (!carrinho.carregado) {
    void carrinho.carregar()
  }
})

/** Só o primeiro endereço é pré-escolhido, para a pessoa não ter de clicar. */
watch(
  () => enderecos.dados.value,
  (lista) => {
    if (lista?.length && enderecoEscolhido.value === null) {
      enderecoEscolhido.value = lista[0].id
    }
  },
)

const enderecoSelecionado = computed(
  () => enderecos.dados.value?.find((item) => item.id === enderecoEscolhido.value) ?? null,
)

const freteSelecionado = computed(
  () => opcoesDeFrete.value.find((item) => item.servico === servicoEscolhido.value) ?? null,
)

async function cotar(): Promise<void> {
  if (enderecoEscolhido.value === null) {
    return
  }

  cotando.value = true
  erroDaCotacao.value = null
  opcoesDeFrete.value = []

  try {
    opcoesDeFrete.value = await cotarFrete(enderecoEscolhido.value)
    // Mantém a escolha anterior só se ela ainda existir para este destino.
    if (!opcoesDeFrete.value.some((item) => item.servico === servicoEscolhido.value)) {
      servicoEscolhido.value = null
    }
  } catch (falha) {
    erroDaCotacao.value = deErro(falha)
  } finally {
    cotando.value = false
  }
}

function irParaEntrega(): void {
  passo.value = 'entrega'
  void cotar()
}

function enderecoCriado(novo: Endereco): void {
  void enderecos.executar()
  enderecoEscolhido.value = novo.id
  irParaEntrega()
}

async function fechar(): Promise<void> {
  // Trava de reentrância, além do botão que se desabilita sozinho: o botão é
  // interface, e interface pode ser contornada por um clique duplo rápido,
  // por um atalho de teclado ou por um recarregamento de módulo em
  // desenvolvimento. Duas chamadas aqui são dois pedidos — e pedido em
  // duplicidade não se desfaz recarregando a página.
  if (fechando.value || pedido.value !== null) {
    return
  }

  if (enderecoEscolhido.value === null || servicoEscolhido.value === null) {
    return
  }

  fechando.value = true
  erroDoFechamento.value = null

  try {
    pedido.value = await fecharPedido(enderecoEscolhido.value, servicoEscolhido.value)
    // O backend esvaziou o carrinho; o estado local precisa acompanhar, senão
    // o cabeçalho continuaria contando itens que já viraram pedido.
    await carrinho.carregar()
  } catch (falha) {
    erroDoFechamento.value = deErro(falha)
    // A recusa pode vir de estoque ou de produto retirado de venda: relê o
    // carrinho para a pessoa ver o que mudou.
    await carrinho.carregar()
  } finally {
    fechando.value = false
  }
}

const carregando = computed(
  () => (carrinho.carregando && !carrinho.carregado) || enderecos.carregando.value,
)
</script>

<template>
  <PedidoConfirmado v-if="pedido" :pedido="pedido" />

  <template v-else>
    <h1 class="titulo">Fechar pedido</h1>

    <CarregandoIndicador v-if="carregando" texto="Carregando o fechamento" />

    <MensagemDeErro
      v-else-if="enderecos.erro.value"
      :erro="enderecos.erro.value"
      @repetir="enderecos.executar"
    />

    <EstadoVazio
      v-else-if="carrinho.vazio"
      titulo="Não há o que fechar"
      descricao="Seu carrinho está vazio. Escolha um produto no catálogo."
    >
      <template #acao>
        <RouterLink to="/catalogo" class="ligacao">Ver o catálogo</RouterLink>
      </template>
    </EstadoVazio>

    <EstadoVazio
      v-else-if="carrinho.temIndisponivel"
      titulo="Há um produto indisponível no carrinho"
      descricao="Retire o item marcado como indisponível para continuar."
    >
      <template #acao>
        <RouterLink to="/carrinho" class="ligacao">Voltar ao carrinho</RouterLink>
      </template>
    </EstadoVazio>

    <template v-else>
      <PassosDoCheckout :atual="passo" @voltar-para="passo = $event" />

      <SelecaoDeEndereco
        v-if="passo === 'endereco'"
        :enderecos="enderecos.dados.value ?? []"
        :selecionado="enderecoEscolhido"
        @escolher="enderecoEscolhido = $event"
        @criado="enderecoCriado"
        @continuar="irParaEntrega"
      />

      <SelecaoDeFrete
        v-else-if="passo === 'entrega'"
        :opcoes="opcoesDeFrete"
        :selecionado="servicoEscolhido"
        :carregando="cotando"
        :erro="erroDaCotacao"
        @escolher="servicoEscolhido = $event"
        @continuar="passo = 'resumo'"
        @repetir="cotar"
      />

      <ResumoDoPedido
        v-else-if="enderecoSelecionado && freteSelecionado"
        :itens="carrinho.itens"
        :subtotal="carrinho.total"
        :endereco="enderecoSelecionado"
        :frete="freteSelecionado"
        :fechando="fechando"
        :erro="erroDoFechamento"
        @fechar="fechar"
      />
    </template>
  </template>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
  margin-bottom: var(--e5);
}

.ligacao {
  font-weight: 600;
}
</style>
