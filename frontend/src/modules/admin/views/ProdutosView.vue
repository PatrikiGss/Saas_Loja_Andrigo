<script setup lang="ts">
/**
 * Catálogo pela visão da equipe.
 *
 * Traz o catálogo inteiro, inclusive o que está fora de venda — é a mesma
 * rota do cliente, só que o backend para de filtrar por `ativo` quando quem
 * pergunta é admin.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import PaginacaoLista from '@/components/PaginacaoLista.vue'
import TabelaDados, { type Coluna } from '@/components/TabelaDados.vue'
import { useFormulario } from '@/composables/useFormulario'
import { useRequisicao } from '@/composables/useRequisicao'
import { corDaCategoria } from '@/modules/loja/categorias'
import { moeda } from '@/utils/formato'
import AjusteDeEstoque from '../components/AjusteDeEstoque.vue'
import { listarProdutos, removerProduto } from '../services/produtos'
import type { ProdutoGestao } from '../types'

const POR_PAGINA = 20

const COLUNAS: Coluna[] = [
  { chave: 'produto', titulo: 'Produto' },
  { chave: 'preco', titulo: 'Preço' },
  { chave: 'estoque', titulo: 'Estoque' },
  { chave: 'situacao', titulo: 'Situação' },
  { chave: 'acoes' },
]

const rota = useRoute()
const router = useRouter()

const pagina = computed(() => Number(rota.query.pagina) || 1)
const busca = ref(String(rota.query.busca ?? ''))

const { dados, carregando, erro, respondeu, executar } = useRequisicao(() =>
  listarProdutos({ pagina: pagina.value, busca: String(rota.query.busca ?? '') }),
)

watch(() => [pagina.value, rota.query.busca], () => void executar())

const produtos = computed(() => dados.value?.results ?? [])
const total = computed(() => dados.value?.count ?? 0)
const vazio = computed(() => respondeu.value && !erro.value && produtos.value.length === 0)

function navegar(query: Record<string, string | undefined>): void {
  void router.push({ name: 'admin-produtos', query })
}

const paraRemover = ref<ProdutoGestao | null>(null)

const {
  enviando: removendo,
  erro: erroAoRemover,
  submeter: confirmarRemocao,
} = useFormulario(async () => {
  await removerProduto((paraRemover.value as ProdutoGestao).id)
  paraRemover.value = null
  await executar()
})

/**
 * Estoques que mudaram desde a última leitura da lista.
 *
 * O ajuste devolve o estoque já calculado pelo banco, mas escrever esse
 * número direto no objeto do produto não aparece na tela: `useRequisicao`
 * guarda os dados em `shallowRef`, que acompanha a troca da lista inteira e
 * não a alteração de um campo lá dentro. O mapa é um valor próprio, e esse
 * o Vue observa.
 */
const estoqueAjustado = ref<Record<string, number>>({})

watch(dados, () => {
  estoqueAjustado.value = {}
})

function estoqueDe(produto: ProdutoGestao): number {
  return estoqueAjustado.value[produto.id] ?? produto.estoque
}

function aplicarEstoque(produto: ProdutoGestao, estoque: number): void {
  estoqueAjustado.value = { ...estoqueAjustado.value, [produto.id]: estoque }
}
</script>

<template>
  <header class="topo">
    <h1 class="topo__titulo">Produtos</h1>
    <RouterLink to="/admin/produtos/novo" class="topo__acao">Cadastrar produto</RouterLink>
  </header>

  <form class="busca" role="search" @submit.prevent="navegar({ busca: busca || undefined })">
    <label class="apenas-leitor" for="busca-admin">Buscar por nome, marca ou SKU</label>
    <input
      id="busca-admin"
      v-model="busca"
      class="busca__campo"
      type="search"
      placeholder="Buscar por nome, marca ou SKU"
    />
    <BotaoBase tipo="submit" variante="secundario">Buscar</BotaoBase>
  </form>

  <CarregandoIndicador v-if="carregando" texto="Carregando o catálogo" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <EstadoVazio
    v-else-if="vazio"
    titulo="Nenhum produto encontrado"
    descricao="Cadastre um produto ou procure por outro termo."
  />

  <template v-else>
    <MensagemDeErro
      v-if="erroAoRemover"
      :erro="erroAoRemover"
      sem-repetir
      class="recusa"
    />

    <p class="contagem">
      <span class="numerico">{{ total }}</span>
      {{ total === 1 ? 'produto' : 'produtos' }}
    </p>

    <TabelaDados
      :colunas="COLUNAS"
      :itens="produtos"
      :chave-de="(produto) => produto.id"
      descricao="Produtos do catálogo"
    >
      <template #produto="{ item }">
        <span class="produto">
          <span
            class="produto__cor"
            :style="{ background: corDaCategoria(item.categoria) }"
            aria-hidden="true"
          />
          <span>
            <RouterLink
              class="produto__nome"
              :to="{ name: 'admin-produto', params: { id: item.id } }"
            >
              {{ item.nome }}
            </RouterLink>
            <span class="produto__sku numerico">{{ item.sku }}</span>
          </span>
        </span>
      </template>

      <template #preco="{ item }">
        <span class="numerico">{{ moeda(item.preco) }}</span>
      </template>

      <template #estoque="{ item }">
        <span class="estoque numerico">{{ estoqueDe(item) }}</span>
        <AjusteDeEstoque
          :id="item.id"
          :estoque="estoqueDe(item)"
          @ajustado="aplicarEstoque(item, $event)"
        />
      </template>

      <template #situacao="{ item }">
        <span class="situacao" :class="{ 'situacao--fora': !item.ativo }">
          {{ item.ativo ? 'À venda' : 'Fora de venda' }}
        </span>
      </template>

      <template #acoes="{ item }">
        <BotaoBase variante="discreto" @click="paraRemover = item">Excluir</BotaoBase>
      </template>
    </TabelaDados>

    <PaginacaoLista
      :pagina="pagina"
      :total="total"
      :por-pagina="POR_PAGINA"
      :desabilitado="carregando"
      @ir-para="navegar({ busca: busca || undefined, pagina: $event > 1 ? String($event) : undefined })"
    />
  </template>

  <DialogoDeConfirmacao
    :aberto="paraRemover !== null"
    titulo="Excluir este produto?"
    descricao="Produto que já foi comprado ou está em algum carrinho não pode ser excluído — nesse caso, tire de venda em vez de excluir."
    confirmar="Excluir produto"
    :processando="removendo"
    @confirmar="confirmarRemocao"
    @cancelar="paraRemover = null"
  />
</template>

<style scoped>
.topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--e4);
  flex-wrap: wrap;
  margin-bottom: var(--e5);
}

.topo__titulo {
  font-size: var(--texto-xl);
  font-stretch: 85%;
}

.topo__acao {
  font-size: var(--texto-sm);
  font-weight: 600;
}

.busca {
  display: flex;
  gap: var(--e2);
  max-width: 30rem;
  margin-bottom: var(--e5);
}

.busca__campo {
  flex: 1;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0 var(--e3);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-sm);
}

.recusa,
.contagem {
  margin-bottom: var(--e4);
}

.contagem {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.produto {
  display: flex;
  align-items: flex-start;
  gap: var(--e2);
}

.produto__cor {
  width: 0.625rem;
  height: 0.625rem;
  margin-top: 0.3rem;
  flex: none;
}

.produto__nome {
  display: block;
  font-weight: 600;
  text-decoration: none;
}

.produto__nome:hover {
  text-decoration: underline;
}

.produto__sku {
  display: block;
  font-size: var(--texto-xs);
  color: var(--tinta-fraca);
}

.estoque {
  display: block;
  font-weight: 700;
  margin-bottom: var(--e2);
}

.situacao {
  font-weight: 600;
}

.situacao--fora {
  color: var(--tinta-media);
}
</style>
