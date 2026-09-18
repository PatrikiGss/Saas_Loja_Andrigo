<script setup lang="ts">
/**
 * Porta de entrada da loja.
 *
 * O catálogo ainda não tem imagem de produto no backend, então o que abre a
 * página é o próprio código de cor das categorias. Os nomes e os subtipos vêm
 * de `GET /api/subtipos/` — nada aqui é lista fixa copiada do backend.
 */
import { computed } from 'vue'

import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useRequisicao } from '@/composables/useRequisicao'
import { agruparPorCategoria, corDaCategoria } from '../categorias'
import { listarSubtipos } from '../services/catalogo'

const { dados, carregando, erro, vazio, executar } = useRequisicao(listarSubtipos)
const categorias = computed(() => agruparPorCategoria(dados.value ?? []))
</script>

<template>
  <section class="abertura">
    <h1 class="abertura__titulo">Pods, vapes<br />e essências.</h1>
    <p class="abertura__texto">
      Cada categoria tem uma cor, e ela acompanha o produto da vitrine até o pedido.
    </p>
  </section>

  <CarregandoIndicador v-if="carregando" texto="Carregando as categorias" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <EstadoVazio
    v-else-if="vazio"
    titulo="O catálogo ainda está vazio"
    descricao="Assim que a equipe cadastrar os primeiros subtipos, eles aparecem aqui."
  />

  <ul v-else class="parede">
    <li v-for="categoria in categorias" :key="categoria.slug" class="familia">
      <span
        class="familia__cor"
        :style="{ background: corDaCategoria(categoria.slug) }"
        aria-hidden="true"
      />
      <h2 class="familia__nome">{{ categoria.nome }}</h2>
      <ul class="familia__subtipos">
        <li v-for="subtipo in categoria.subtipos" :key="subtipo.slug">{{ subtipo.nome }}</li>
      </ul>
    </li>
  </ul>
</template>

<style scoped>
.abertura {
  margin-bottom: var(--e8);
}

.abertura__titulo {
  font-size: var(--texto-display);
  font-weight: 800;
  font-stretch: 72%;
  line-height: 0.92;
  letter-spacing: -0.025em;
}

.abertura__texto {
  margin-top: var(--e5);
  max-width: 34ch;
  font-size: var(--texto-md);
  color: var(--tinta-media);
}

.parede {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: var(--e5);
  list-style: none;
  padding: 0;
}

.familia__cor {
  display: block;
  aspect-ratio: 3 / 4;
  border-radius: var(--raio-bloco);
}

.familia__nome {
  margin-top: var(--e3);
  font-size: var(--texto-base);
  font-weight: 700;
}

.familia__subtipos {
  margin-top: var(--e2);
  list-style: none;
  padding: 0;
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

@media (max-width: 30rem) {
  .parede {
    grid-template-columns: repeat(2, 1fr);
  }

  .familia__cor {
    aspect-ratio: 1 / 1;
  }
}
</style>
