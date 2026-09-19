<script setup lang="ts">
/**
 * Filtros do catálogo.
 *
 * Só existe aqui o que o backend sabe filtrar: categoria, subtipo, busca e
 * ordenação. Faixa de preço, marca e disponibilidade não entram porque a API
 * não os aceita — filtro que o servidor ignora é promessa quebrada na tela.
 *
 * As categorias vêm dos subtipos que a API devolveu, e não de uma lista
 * escrita aqui.
 */
import { computed, ref, watch } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import { agruparPorCategoria, corDaCategoria } from '../categorias'
import { ORDENACOES, type FiltrosDoCatalogo, type Ordenacao, type Subtipo } from '../types'

const props = defineProps<{
  subtipos: Subtipo[]
  filtros: FiltrosDoCatalogo
}>()

const emit = defineEmits<{ alterar: [filtros: FiltrosDoCatalogo] }>()

const categorias = computed(() => agruparPorCategoria(props.subtipos))

/** Subtipos da categoria escolhida; sem categoria, não há o que escolher. */
const subtiposVisiveis = computed(
  () => categorias.value.find((item) => item.slug === props.filtros.categoria)?.subtipos ?? [],
)

// A busca tem estado próprio porque só vale quando a pessoa envia: a cada
// tecla seria uma requisição, e o backend limita chamadas por minuto.
const busca = ref(props.filtros.busca ?? '')
watch(
  () => props.filtros.busca,
  (valor) => {
    busca.value = valor ?? ''
  },
)

function alterar(mudanca: Partial<FiltrosDoCatalogo>): void {
  // Qualquer mudança de filtro volta para a primeira página: a página 3 do
  // filtro anterior não tem relação com o resultado novo.
  emit('alterar', { ...props.filtros, ...mudanca, pagina: 1 })
}

function escolherCategoria(slug: string | undefined): void {
  // Trocar de categoria zera o subtipo: ele pertencia à categoria anterior.
  alterar({ categoria: slug, subtipo: undefined })
}

const temFiltro = computed(() =>
  Boolean(props.filtros.categoria || props.filtros.subtipo || props.filtros.busca),
)
</script>

<template>
  <div class="filtros">
    <form class="busca" role="search" @submit.prevent="alterar({ busca })">
      <label class="apenas-leitor" for="busca-catalogo">Buscar por nome, marca ou SKU</label>
      <input
        id="busca-catalogo"
        v-model="busca"
        class="busca__campo"
        type="search"
        placeholder="Buscar por nome, marca ou SKU"
      />
      <BotaoBase tipo="submit" variante="secundario">Buscar</BotaoBase>
    </form>

    <div class="categorias" role="group" aria-label="Categorias">
      <button
        type="button"
        class="chip"
        :class="{ 'chip--ativo': !filtros.categoria }"
        @click="escolherCategoria(undefined)"
      >
        Todas
      </button>

      <button
        v-for="categoria in categorias"
        :key="categoria.slug"
        type="button"
        class="chip"
        :class="{ 'chip--ativo': filtros.categoria === categoria.slug }"
        :aria-pressed="filtros.categoria === categoria.slug"
        @click="escolherCategoria(categoria.slug)"
      >
        <span
          class="chip__cor"
          :style="{ background: corDaCategoria(categoria.slug) }"
          aria-hidden="true"
        />
        {{ categoria.nome }}
      </button>
    </div>

    <div class="refino">
      <label v-if="subtiposVisiveis.length" class="refino__campo">
        <span class="refino__rotulo">Subtipo</span>
        <select
          class="refino__select"
          :value="filtros.subtipo ?? ''"
          @change="alterar({ subtipo: ($event.target as HTMLSelectElement).value || undefined })"
        >
          <option value="">Todos</option>
          <option v-for="subtipo in subtiposVisiveis" :key="subtipo.slug" :value="subtipo.slug">
            {{ subtipo.nome }}
          </option>
        </select>
      </label>

      <label class="refino__campo">
        <span class="refino__rotulo">Ordenar por</span>
        <select
          class="refino__select"
          :value="filtros.ordem ?? 'nome'"
          @change="alterar({ ordem: ($event.target as HTMLSelectElement).value as Ordenacao })"
        >
          <option v-for="opcao in ORDENACOES" :key="opcao.valor" :value="opcao.valor">
            {{ opcao.texto }}
          </option>
        </select>
      </label>

      <BotaoBase
        v-if="temFiltro"
        variante="discreto"
        @click="emit('alterar', { ordem: filtros.ordem, pagina: 1 })"
      >
        Limpar filtros
      </BotaoBase>
    </div>
  </div>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  margin-bottom: var(--e6);
}

.busca {
  display: flex;
  gap: var(--e2);
  max-width: 32rem;
}

.busca__campo {
  flex: 1;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 var(--e3);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
}

.busca__campo::placeholder {
  color: var(--tinta-fraca);
}

.categorias {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e4);
}

/* Chip é texto, não pílula colorida: a cor fica no quadrado, que funciona em
   qualquer um dos cinco matizes sem variante escura para passar em contraste. */
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--e2);
  padding: var(--e1) 0;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  font-size: var(--texto-sm);
  font-weight: 500;
  color: var(--tinta-media);
  cursor: pointer;
}

.chip:hover {
  color: var(--tinta);
}

.chip--ativo {
  border-bottom-color: var(--tinta);
  color: var(--tinta);
  font-weight: 700;
}

.chip__cor {
  width: 0.625rem;
  height: 0.625rem;
  flex: none;
}

.refino {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--e4);
}

.refino__campo {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}

.refino__rotulo {
  font-size: var(--texto-xs);
  font-weight: 600;
  color: var(--tinta-media);
}

.refino__select {
  min-height: 2.25rem;
  padding: 0 var(--e2);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-sm);
  cursor: pointer;
}

@media (max-width: 30rem) {
  .busca {
    flex-direction: column;
  }
}
</style>
