<script setup lang="ts">
/**
 * Cadastro e edição de produto.
 *
 * As três especificações aparecem sempre, e não só nas categorias em que se
 * aplicam. É escolha deliberada: quais valem em cada categoria é regra do
 * backend (`ESPECIFICACOES_POR_CATEGORIA`), não existe endpoint que a
 * publique, e copiá-la para cá criaria uma segunda verdade que sai do ar em
 * silêncio quando a primeira mudar. Quando não se aplica, o servidor recusa
 * com 'Não se aplica a esta categoria.' no próprio campo.
 *
 * `estoque` não está aqui: ele só muda pelo endpoint de ajuste.
 */
import { ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import type { CamposComErro } from '@/services/erros'
import type { Subtipo } from '@/modules/loja/types'
import type { DadosDeProduto, ProdutoGestao } from '../types'

const props = withDefaults(
  defineProps<{
    subtipos: Subtipo[]
    valorInicial?: ProdutoGestao | null
    enviando?: boolean
    campos?: CamposComErro
    textoDoBotao?: string
  }>(),
  { textoDoBotao: 'Salvar produto' },
)

const emit = defineEmits<{ enviar: [dados: DadosDeProduto] }>()

/** O formulário trabalha com texto; números vazios viram nulo no envio. */
const dados = ref({
  sku: props.valorInicial?.sku ?? '',
  nome: props.valorInicial?.nome ?? '',
  descricao: props.valorInicial?.descricao ?? '',
  marca: props.valorInicial?.marca ?? '',
  subtipo: props.valorInicial?.subtipo ?? '',
  preco: props.valorInicial?.preco ?? '',
  ativo: props.valorInicial?.ativo ?? true,
  puffs: props.valorInicial?.puffs?.toString() ?? '',
  volume_ml: props.valorInicial?.volume_ml ?? '',
  nicotina_mg_ml: props.valorInicial?.nicotina_mg_ml ?? '',
})

function texto(valor: string): string | null {
  return valor.trim() === '' ? null : valor.trim()
}

function enviar(): void {
  emit('enviar', {
    sku: dados.value.sku.trim().toUpperCase(),
    nome: dados.value.nome.trim(),
    descricao: dados.value.descricao.trim(),
    marca: dados.value.marca.trim(),
    subtipo: dados.value.subtipo,
    preco: dados.value.preco.trim(),
    ativo: dados.value.ativo,
    puffs: texto(dados.value.puffs) === null ? null : Number(dados.value.puffs),
    volume_ml: texto(dados.value.volume_ml),
    nicotina_mg_ml: texto(dados.value.nicotina_mg_ml),
  })
}
</script>

<template>
  <form class="formulario" novalidate @submit.prevent="enviar">
    <div class="dupla">
      <CampoTexto
        v-model="dados.sku"
        rotulo="SKU"
        :maxlength="32"
        obrigatorio
        dica="Maiúsculas, números e hífen, a partir de 4 caracteres."
        :erro="campos?.sku"
        :desabilitado="enviando"
      />
      <CampoTexto
        v-model="dados.preco"
        rotulo="Preço"
        inputmode="numeric"
        obrigatorio
        dica="Use ponto para os centavos: 49.90"
        :erro="campos?.preco"
        :desabilitado="enviando"
      />
    </div>

    <CampoTexto
      v-model="dados.nome"
      rotulo="Nome"
      :maxlength="120"
      obrigatorio
      :erro="campos?.nome"
      :desabilitado="enviando"
    />

    <CampoTexto
      v-model="dados.marca"
      rotulo="Marca"
      :maxlength="60"
      obrigatorio
      :erro="campos?.marca"
      :desabilitado="enviando"
    />

    <div class="campo">
      <label class="campo__rotulo" for="subtipo">
        Subtipo
        <span class="campo__obrigatorio" aria-hidden="true">*</span>
      </label>
      <select
        id="subtipo"
        v-model="dados.subtipo"
        class="campo__select"
        :disabled="enviando"
        :aria-invalid="campos?.subtipo ? true : undefined"
        required
      >
        <option value="" disabled>Escolha</option>
        <option v-for="item in subtipos" :key="item.slug" :value="item.slug">
          {{ item.categoria_display }} — {{ item.nome }}
        </option>
      </select>
      <p v-if="campos?.subtipo" class="campo__erro">{{ campos.subtipo }}</p>
      <p v-else class="campo__dica">A categoria vem do subtipo escolhido.</p>
    </div>

    <div class="campo">
      <label class="campo__rotulo" for="descricao">Descrição</label>
      <textarea
        id="descricao"
        v-model="dados.descricao"
        class="campo__area"
        rows="4"
        maxlength="2000"
        :disabled="enviando"
      />
      <p v-if="campos?.descricao" class="campo__erro">{{ campos.descricao }}</p>
    </div>

    <fieldset class="especificacoes">
      <legend class="especificacoes__titulo">Especificações</legend>
      <p class="especificacoes__nota">
        Preencha só as que valem para a categoria do subtipo. O servidor recusa o que não
        se aplica e cobra o que falta.
      </p>

      <div class="tripla">
        <CampoTexto
          v-model="dados.puffs"
          rotulo="Puffs"
          inputmode="numeric"
          :erro="campos?.puffs"
          :desabilitado="enviando"
        />
        <CampoTexto
          v-model="dados.volume_ml"
          rotulo="Volume (ml)"
          inputmode="numeric"
          :erro="campos?.volume_ml"
          :desabilitado="enviando"
        />
        <CampoTexto
          v-model="dados.nicotina_mg_ml"
          rotulo="Nicotina (mg/ml)"
          inputmode="numeric"
          :erro="campos?.nicotina_mg_ml"
          :desabilitado="enviando"
        />
      </div>
    </fieldset>

    <label class="venda">
      <input v-model="dados.ativo" type="checkbox" :disabled="enviando" />
      <span>
        À venda no catálogo
        <span class="venda__nota">Desmarcado, o produto some da loja e fica só aqui.</span>
      </span>
    </label>

    <div class="acoes">
      <BotaoBase tipo="submit" :carregando="enviando">{{ textoDoBotao }}</BotaoBase>
      <slot name="acoes" />
    </div>
  </form>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 38rem;
}

.dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--e4);
}

.tripla {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--e3);
}

.campo {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}

.campo__rotulo {
  font-size: var(--texto-sm);
  font-weight: 600;
}

.campo__obrigatorio {
  color: var(--alerta);
}

.campo__select,
.campo__area {
  padding: var(--e2) var(--e3);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
}

.campo__select {
  min-height: 2.75rem;
}

.campo__area {
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.campo__erro {
  font-size: var(--texto-xs);
  color: var(--alerta);
}

.campo__dica {
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.especificacoes {
  border: 0;
  border-top: 1px solid var(--linha);
  padding: var(--e4) 0 0;
  margin: var(--e2) 0 0;
}

.especificacoes__titulo {
  padding: 0;
  font-size: var(--texto-sm);
  font-weight: 700;
}

.especificacoes__nota {
  margin: var(--e2) 0 var(--e4);
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.venda {
  display: flex;
  align-items: flex-start;
  gap: var(--e2);
  font-size: var(--texto-sm);
  font-weight: 600;
}

.venda input {
  margin-top: 0.2rem;
  accent-color: var(--tinta);
}

.venda__nota {
  display: block;
  font-weight: 400;
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.acoes {
  display: flex;
  gap: var(--e2);
  margin-top: var(--e2);
}

@media (max-width: 34rem) {
  .dupla,
  .tripla {
    grid-template-columns: 1fr;
  }
}
</style>
