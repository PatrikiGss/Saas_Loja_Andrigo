<script setup lang="ts">
/**
 * Página de um produto.
 *
 * O id é UUID de propósito no backend, para a API não expor uma sequência
 * adivinhável. Produto inativo responde 404 aqui, como qualquer id que não
 * existe — e a tela trata os dois do mesmo jeito, porque para quem olha são
 * a mesma coisa.
 */
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useRequisicao } from '@/composables/useRequisicao'
import { moeda } from '@/utils/formato'
import AdicionarAoCarrinho from '../components/AdicionarAoCarrinho.vue'
import BlocoDoProduto from '../components/BlocoDoProduto.vue'
import EspecificacoesProduto from '../components/EspecificacoesProduto.vue'
import SeloCategoria from '../components/SeloCategoria.vue'
import { buscarProduto, listarSubtipos } from '../services/catalogo'

const rota = useRoute()

const { dados: produto, carregando, erro, executar } = useRequisicao(() =>
  buscarProduto(String(rota.params.id)),
)

// Os subtipos trazem o nome legível da categoria; sem eles restaria o slug,
// que é identificador e não texto de interface.
const subtipos = useRequisicao(listarSubtipos)

const nomeDaCategoria = computed(
  () =>
    subtipos.dados.value?.find((item) => item.categoria === produto.value?.categoria)
      ?.categoria_display,
)

const nomeDoSubtipo = computed(
  () => subtipos.dados.value?.find((item) => item.slug === produto.value?.subtipo)?.nome,
)

watch(() => rota.params.id, () => void executar())
</script>

<template>
  <CarregandoIndicador v-if="carregando" texto="Carregando o produto" />

  <div v-else-if="erro" class="falha">
    <MensagemDeErro :erro="erro" @repetir="executar" />
    <p><RouterLink to="/catalogo">Voltar para o catálogo</RouterLink></p>
  </div>

  <article v-else-if="produto" class="produto">
    <div class="produto__imagem">
      <BlocoDoProduto
        :categoria="produto.categoria"
        :sku="produto.sku"
        formato="quadrado"
        :esgotado="!produto.em_estoque"
      />
    </div>

    <div class="produto__dados">
      <header class="cabecalho">
        <SeloCategoria
          v-if="nomeDaCategoria"
          :slug="produto.categoria"
          :nome="nomeDaCategoria"
        />
        <h1 class="produto__nome">{{ produto.nome }}</h1>
        <p class="produto__marca">{{ produto.marca }}</p>
      </header>

      <p class="produto__preco numerico">{{ moeda(produto.preco) }}</p>

      <p v-if="produto.descricao" class="produto__descricao">{{ produto.descricao }}</p>

      <EspecificacoesProduto :produto="produto" :subtipo="nomeDoSubtipo" />

      <AdicionarAoCarrinho :produto="produto" />

      <p class="produto__sku">SKU <span class="numerico">{{ produto.sku }}</span></p>
    </div>
  </article>
</template>

<style scoped>
.produto {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  gap: var(--e8);
  align-items: start;
}

.produto__imagem {
  position: sticky;
  top: var(--e5);
}

.produto__dados {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}

/* Selo, nome e marca são um bloco só, mais apertado que o resto da coluna. */
.cabecalho {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}

.produto__nome {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
}

.produto__marca {
  color: var(--tinta-media);
}

.produto__preco {
  font-size: var(--texto-xl);
  font-weight: 700;
}

.produto__descricao {
  color: var(--tinta-media);
  line-height: 1.6;
}

.produto__sku {
  font-size: var(--texto-xs);
  color: var(--tinta-fraca);
}

.falha {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  font-size: var(--texto-sm);
}

@media (max-width: 48rem) {
  .produto {
    grid-template-columns: 1fr;
    gap: var(--e5);
  }

  .produto__imagem {
    position: static;
    max-width: 20rem;
  }
}
</style>
