<script setup lang="ts">
/**
 * Histórico de pedidos.
 *
 * A página vem da URL, como no catálogo: voltar funciona e um link para a
 * página 2 reabre na página 2.
 */
import { RouterLink, useRouter } from 'vue-router'

import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import PaginacaoLista from '@/components/PaginacaoLista.vue'
import { useListaPaginada } from '@/composables/useListaPaginada'
import { POR_PAGINA } from '@/services/paginacao'
import { useSessao } from '@/modules/auth/stores/sessao'
import { dataHora, moeda } from '@/utils/formato'
import SeloDeStatus from '../components/SeloDeStatus.vue'
import { listarPedidos } from '../services/pedidos'

const router = useRouter()
const sessao = useSessao()

const {
  pagina,
  itens: pedidos,
  total,
  vazio: semPedidos,
  carregando,
  erro,
  executar,
} = useListaPaginada(listarPedidos)

function irParaPagina(destino: number): void {
  void router.push({
    name: 'pedidos',
    query: destino > 1 ? { pagina: String(destino) } : {},
  })
}

/** Quantos itens a compra tinha, somando as quantidades congeladas. */
function quantidade(itens: { quantidade: number }[]): number {
  return itens.reduce((soma, item) => soma + item.quantidade, 0)
}
</script>

<template>
  <h1 class="titulo">Meus pedidos</h1>

  <!-- Conta admin enxerga os pedidos de todo mundo: é a política do backend,
       não uma falha desta tela. A Etapa 8 dá um lugar próprio para isso. -->
  <p v-if="sessao.ehAdmin" class="aviso-admin">
    Sua conta é administrativa, então esta lista traz os pedidos de todas as contas.
  </p>

  <CarregandoIndicador v-if="carregando" texto="Carregando seus pedidos" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <EstadoVazio
    v-else-if="semPedidos"
    titulo="Você ainda não fez nenhum pedido"
    descricao="Quando fechar uma compra, ela aparece aqui com o acompanhamento."
  >
    <template #acao>
      <RouterLink to="/catalogo" class="ligacao">Ver o catálogo</RouterLink>
    </template>
  </EstadoVazio>

  <template v-else>
    <ul class="lista">
      <li v-for="pedido in pedidos" :key="pedido.numero" class="linha">
        <RouterLink class="linha__link" :to="{ name: 'pedido', params: { numero: pedido.numero } }">
          <span class="linha__numero numerico">{{ pedido.numero }}</span>
          <span class="linha__data">{{ dataHora(pedido.criado_em) }}</span>
        </RouterLink>

        <span class="linha__itens">
          <span class="numerico">{{ quantidade(pedido.itens) }}</span>
          {{ quantidade(pedido.itens) === 1 ? 'item' : 'itens' }}
        </span>

        <SeloDeStatus :status="pedido.status" />

        <span class="linha__total numerico">{{ moeda(pedido.total) }}</span>
      </li>
    </ul>

    <PaginacaoLista
      :pagina="pagina"
      :total="total"
      :por-pagina="POR_PAGINA"
      :desabilitado="carregando"
      @ir-para="irParaPagina"
    />
  </template>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
  margin-bottom: var(--e5);
}

.aviso-admin {
  margin-bottom: var(--e5);
  padding-left: var(--e3);
  border-left: 3px solid var(--linha-forte);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.lista {
  list-style: none;
  padding: 0;
  border-top: 1px solid var(--linha);
}

.linha {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--e5);
  padding: var(--e4) 0;
  border-bottom: 1px solid var(--linha);
}

.linha__link {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  text-decoration: none;
}

.linha__numero {
  font-weight: 700;
  font-size: var(--texto-sm);
}

.linha__link:hover .linha__numero {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.linha__data,
.linha__itens {
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.linha__total {
  font-weight: 700;
  min-width: 6rem;
  text-align: right;
}

.ligacao {
  font-weight: 600;
}

@media (max-width: 40rem) {
  .linha {
    grid-template-columns: 1fr auto;
    row-gap: var(--e2);
  }

  .linha__link {
    grid-column: 1 / -1;
  }

  .linha__total {
    text-align: right;
  }
}
</style>
