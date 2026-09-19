<script setup lang="ts">
/**
 * Pedidos da loja inteira.
 *
 * Quem move o pedido no fluxo é o backend, que só aceita transição prevista.
 * A tela oferece todos os status em vez de adivinhar quais valem a partir do
 * atual: o mapa de transições é regra do backend (`TRANSICOES`), não há
 * endpoint que o publique, e copiá-lo para cá criaria uma segunda verdade.
 * Escolha fora do fluxo volta com 400 e a frase dizendo de onde para onde
 * não dá.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import PaginacaoLista from '@/components/PaginacaoLista.vue'
import { useRequisicao } from '@/composables/useRequisicao'
import { deErro, type ErroDaApi } from '@/services/erros'
import SeloDeStatus from '@/modules/pedidos/components/SeloDeStatus.vue'
import { listarPedidos } from '@/modules/pedidos/services/pedidos'
import { FLUXO, textoDoStatus, type StatusPedido } from '@/modules/pedidos/types'
import { dataHora, moeda } from '@/utils/formato'
import { alterarStatus } from '../services/pedidos'

const POR_PAGINA = 20

/** Os do fluxo mais o cancelamento, que é saída e não etapa. */
const STATUS_OFERECIDOS: StatusPedido[] = [...FLUXO, 'cancelado']

const rota = useRoute()
const router = useRouter()

const pagina = computed(() => Number(rota.query.pagina) || 1)

const { dados, carregando, erro, respondeu, executar } = useRequisicao(() =>
  listarPedidos(pagina.value),
)

watch(pagina, () => void executar())

const pedidos = computed(() => dados.value?.results ?? [])
const total = computed(() => dados.value?.count ?? 0)
const vazio = computed(() => respondeu.value && !erro.value && pedidos.value.length === 0)

const emMudanca = ref<string | null>(null)
const erroDaAcao = ref<ErroDaApi | null>(null)
const recusaDaTransicao = ref<string | null>(null)
const escolhas = ref<Record<string, StatusPedido>>({})

async function mover(numero: string): Promise<void> {
  const destino = escolhas.value[numero]
  const pedido = pedidos.value.find((item) => item.numero === numero)
  if (!destino || !pedido || emMudanca.value !== null) {
    return
  }

  emMudanca.value = numero
  erroDaAcao.value = null
  recusaDaTransicao.value = null

  try {
    await alterarStatus(numero, destino)
    await executar()
  } catch (falha) {
    const problema = deErro(falha)
    erroDaAcao.value = problema
    // A frase do backend cita os identificadores ('de aguardando_pagamento
    // para enviado'), que são de dentro do sistema. Quem recusou continua
    // sendo ele; aqui só se escreve a mesma recusa com os rótulos da tela.
    recusaDaTransicao.value = problema.campos.status
      ? `Não dá para ir de “${textoDoStatus(pedido.status)}” para “${textoDoStatus(destino)}”.`
      : null
  } finally {
    emMudanca.value = null
  }
}
</script>

<template>
  <h1 class="titulo">Pedidos</h1>

  <CarregandoIndicador v-if="carregando" texto="Carregando os pedidos" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <EstadoVazio
    v-else-if="vazio"
    titulo="Nenhum pedido ainda"
    descricao="Os pedidos fechados na loja aparecem aqui."
  />

  <template v-else>
    <MensagemDeErro
      v-if="erroDaAcao"
      :erro="erroDaAcao"
      :detalhe="recusaDaTransicao ?? undefined"
      sem-repetir
      class="recusa"
    />

    <table class="tabela">
      <caption class="apenas-leitor">Pedidos de todas as contas</caption>
      <thead>
        <tr>
          <th scope="col">Pedido</th>
          <th scope="col">Total</th>
          <th scope="col">Status</th>
          <th scope="col">Mover para</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="pedido in pedidos" :key="pedido.numero">
          <td>
            <RouterLink
              class="pedido__numero numerico"
              :to="{ name: 'pedido', params: { numero: pedido.numero } }"
            >
              {{ pedido.numero }}
            </RouterLink>
            <span class="pedido__data">{{ dataHora(pedido.criado_em) }}</span>
          </td>

          <td class="numerico">{{ moeda(pedido.total) }}</td>

          <td><SeloDeStatus :status="pedido.status" /></td>

          <td class="mover">
            <label>
              <span class="apenas-leitor">Novo status do pedido {{ pedido.numero }}</span>
              <!-- `:value` e não `v-model`: com o mapa ainda vazio, o v-model
                   não casaria com opção nenhuma e o seletor abriria em branco,
                   sem mostrar o texto que explica o que fazer ali. -->
              <select
                class="mover__select"
                :value="escolhas[pedido.numero] ?? ''"
                :disabled="emMudanca !== null"
                @change="escolhas[pedido.numero] = ($event.target as HTMLSelectElement).value as StatusPedido"
              >
                <option value="" disabled>Escolha</option>
                <option
                  v-for="status in STATUS_OFERECIDOS"
                  :key="status"
                  :value="status"
                  :disabled="status === pedido.status"
                >
                  {{ textoDoStatus(status) }}
                </option>
              </select>
            </label>

            <BotaoBase
              variante="secundario"
              :desabilitado="!escolhas[pedido.numero] || emMudanca !== null"
              :carregando="emMudanca === pedido.numero"
              @click="mover(pedido.numero)"
            >
              Aplicar
            </BotaoBase>
          </td>
        </tr>
      </tbody>
    </table>

    <PaginacaoLista
      :pagina="pagina"
      :total="total"
      :por-pagina="POR_PAGINA"
      :desabilitado="carregando"
      @ir-para="router.push({ name: 'admin-pedidos', query: $event > 1 ? { pagina: String($event) } : {} })"
    />
  </template>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-xl);
  font-stretch: 85%;
  margin-bottom: var(--e5);
}

.recusa {
  margin-bottom: var(--e4);
}

.tabela {
  width: 100%;
  border-collapse: collapse;
}

.tabela th {
  text-align: left;
  padding: var(--e2) var(--e3) var(--e2) 0;
  border-bottom: 1px solid var(--linha-forte);
  font-size: var(--texto-xs);
  font-weight: 700;
  color: var(--tinta-media);
}

.tabela td {
  padding: var(--e3) var(--e3) var(--e3) 0;
  border-bottom: 1px solid var(--linha);
  font-size: var(--texto-sm);
  vertical-align: top;
}

.pedido__numero {
  display: block;
  font-weight: 600;
  text-decoration: none;
}

.pedido__numero:hover {
  text-decoration: underline;
}

.pedido__data {
  display: block;
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.mover {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}

.mover__select {
  min-height: 2.25rem;
  padding: 0 var(--e2);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-sm);
}

.mover :deep(.botao) {
  min-height: 2.25rem;
  padding: 0 var(--e3);
  font-size: var(--texto-xs);
}

@media (max-width: 52rem) {
  .tabela,
  .tabela tbody,
  .tabela tr,
  .tabela td {
    display: block;
    width: 100%;
  }

  .tabela thead {
    display: none;
  }

  .tabela tr {
    padding: var(--e4) 0;
    border-bottom: 1px solid var(--linha);
  }

  .tabela td {
    padding: var(--e1) 0;
    border: 0;
  }
}
</style>
