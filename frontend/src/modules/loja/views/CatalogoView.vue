<script setup lang="ts">
/**
 * Catálogo de produtos.
 *
 * Os filtros moram na URL, não em estado interno: assim o botão voltar
 * funciona, e um link com filtro aplicado pode ser compartilhado e reaberto.
 * A tela só reage à rota — quem escreve na rota é o `alterar`.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import PaginacaoLista from '@/components/PaginacaoLista.vue'
import { useRequisicao } from '@/composables/useRequisicao'
import { POR_PAGINA, paginaDaRota } from '@/services/paginacao'
import CardProduto from '../components/CardProduto.vue'
import FiltrosCatalogo from '../components/FiltrosCatalogo.vue'
import { listarProdutos, listarSubtipos } from '../services/catalogo'
import { ORDENACOES, type FiltrosDoCatalogo, type Ordenacao } from '../types'

const rota = useRoute()
const router = useRouter()

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor ? valor : undefined
}

const filtros = computed<FiltrosDoCatalogo>(() => {
  const ordem = texto(rota.query.ordem)
  return {
    categoria: texto(rota.query.categoria),
    subtipo: texto(rota.query.subtipo),
    busca: texto(rota.query.busca),
    // Ordenação que não existe na API é descartada: ela vem da barra de
    // endereço e o backend recusaria o valor.
    ordem: ORDENACOES.some((opcao) => opcao.valor === ordem) ? (ordem as Ordenacao) : undefined,
    pagina: paginaDaRota(rota.query.pagina),
  }
})

const subtipos = useRequisicao(listarSubtipos)
const produtos = useRequisicao(() => listarProdutos(filtros.value))

watch(filtros, () => void produtos.executar())

function alterar(novos: FiltrosDoCatalogo): void {
  void router.push({
    name: 'catalogo',
    query: {
      categoria: novos.categoria,
      subtipo: novos.subtipo,
      busca: novos.busca?.trim() || undefined,
      ordem: novos.ordem,
      pagina: novos.pagina && novos.pagina > 1 ? String(novos.pagina) : undefined,
    },
  })
}

function irParaPagina(pagina: number): void {
  alterar({ ...filtros.value, pagina })
}

const total = computed(() => produtos.dados.value?.count ?? 0)
const itens = computed(() => produtos.dados.value?.results ?? [])
const nadaEncontrado = computed(
  () => produtos.respondeu.value && !produtos.erro.value && itens.value.length === 0,
)
</script>

<template>
  <h1 class="titulo">Catálogo</h1>

  <FiltrosCatalogo
    v-if="subtipos.dados.value"
    :subtipos="subtipos.dados.value"
    :filtros="filtros"
    @alterar="alterar"
  />

  <CarregandoIndicador v-if="produtos.carregando.value" texto="Carregando os produtos" />

  <MensagemDeErro
    v-else-if="produtos.erro.value"
    :erro="produtos.erro.value"
    @repetir="produtos.executar"
  />

  <EstadoVazio
    v-else-if="nadaEncontrado"
    titulo="Nenhum produto com esses filtros"
    descricao="Tire um filtro ou procure por outro termo."
  />

  <template v-else>
    <p class="contagem">
      <span class="numerico">{{ total }}</span>
      {{ total === 1 ? 'produto' : 'produtos' }}
    </p>

    <ul class="grade">
      <li v-for="produto in itens" :key="produto.id">
        <CardProduto :produto="produto" />
      </li>
    </ul>

    <PaginacaoLista
      :pagina="filtros.pagina ?? 1"
      :total="total"
      :por-pagina="POR_PAGINA"
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

.contagem {
  margin-bottom: var(--e4);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.grade {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--e6) var(--e5);
  list-style: none;
  padding: 0;
}

@media (max-width: 30rem) {
  .grade {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--e5) var(--e4);
  }
}
</style>
