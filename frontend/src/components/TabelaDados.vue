<script setup lang="ts" generic="T">
/**
 * Tabela de dados da gestão.
 *
 * Existe porque as três telas administrativas tinham a mesma marcação e o
 * mesmo CSS copiado, incluindo o bloco que empilha as linhas no celular —
 * onde uma tabela de verdade não cabe e vira rolagem horizontal.
 *
 * Cada coluna traz o rótulo do cabeçalho e o nome do slot que desenha a
 * célula, então a tela decide o conteúdo e não repete a estrutura.
 */
export interface Coluna {
  /** Nome do slot que desenha a célula desta coluna. */
  chave: string
  /** Cabeçalho. Vazio numa coluna de ações, que não precisa de título. */
  titulo?: string
  /** Alinha à direita: dinheiro e contagem lêem melhor assim. */
  aoFim?: boolean
}

defineProps<{
  colunas: Coluna[]
  itens: T[]
  /** Identificador estável de cada linha. */
  chaveDe: (item: T) => string | number
  /** Lido por leitor de tela no lugar de um título visível. */
  descricao: string
}>()

defineSlots<
  {
    [nome: string]: (props: { item: T }) => unknown
  }
>()
</script>

<template>
  <table class="tabela">
    <caption class="apenas-leitor">{{ descricao }}</caption>

    <thead>
      <tr>
        <th
          v-for="coluna in colunas"
          :key="coluna.chave"
          scope="col"
          :class="{ 'tabela__fim': coluna.aoFim }"
        >
          <span v-if="coluna.titulo">{{ coluna.titulo }}</span>
          <span v-else class="apenas-leitor">Ações</span>
        </th>
      </tr>
    </thead>

    <tbody>
      <tr v-for="item in itens" :key="chaveDe(item)">
        <td
          v-for="coluna in colunas"
          :key="coluna.chave"
          :class="{ 'tabela__fim': coluna.aoFim }"
          :data-rotulo="coluna.titulo"
        >
          <slot :name="coluna.chave" :item="item" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
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

.tabela__fim {
  text-align: right;
}

/*
 * No celular a tabela vira lista: cinco colunas em 375px só produziriam
 * rolagem horizontal. O cabeçalho some e cada célula recebe o rótulo dele
 * pelo `data-rotulo`, senão os valores soltos perdem o significado.
 */
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

  .tabela td[data-rotulo]:not(:first-child)::before {
    content: attr(data-rotulo) ': ';
    font-size: var(--texto-xs);
    color: var(--tinta-media);
  }

  .tabela__fim {
    text-align: left;
  }
}
</style>
