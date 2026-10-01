<script setup lang="ts">
/**
 * Cadastro e edição de produto.
 *
 * As especificações que aparecem são as que o subtipo escolhido diz que
 * valem (`especificacoes`, publicado pelo backend a partir da mesma regra que
 * o `clean()` do produto usa). As que não valem vão como nulo, mesmo que algo
 * tenha sido digitado nelas antes de trocar o subtipo.
 *
 * Subtipo fora da lista — a lista não carregou, ou o produto aponta para um
 * que sumiu — volta a mostrar as três e mandar o que estiver nelas: esconder
 * e anular às cegas apagaria as especificações de um produto em edição. Aí
 * quem recusa o que não cabe é o servidor, no próprio campo.
 *
 * `estoque` não está aqui: ele só muda pelo endpoint de ajuste.
 */
import { computed, ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoAreaDeTexto from '@/components/CampoAreaDeTexto.vue'
import CampoSelecao from '@/components/CampoSelecao.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import type { CamposComErro } from '@/services/erros'
import type { Especificacao, Subtipo } from '@/modules/loja/types'
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

/**
 * O que vale para o subtipo escolhido, ou nada quando não dá para saber —
 * nenhum escolhido ainda, ou um que não está na lista.
 */
const especificacoesDoSubtipo = computed<ReadonlySet<Especificacao> | null>(() => {
  const escolhido = props.subtipos.find((item) => item.slug === dados.value.subtipo)
  return escolhido ? new Set(escolhido.especificacoes) : null
})

/** Sem saber o que vale, mostra todas: esconder poderia apagar dado. */
function mostra(campo: Especificacao): boolean {
  return especificacoesDoSubtipo.value?.has(campo) ?? true
}

function texto(valor: string): string | null {
  return valor.trim() === '' ? null : valor.trim()
}

/** O que foi digitado, ou nulo quando a especificação não vale para o subtipo. */
function especificacao(campo: Especificacao): string | null {
  return mostra(campo) ? texto(dados.value[campo]) : null
}

function enviar(): void {
  const puffs = especificacao('puffs')
  emit('enviar', {
    sku: dados.value.sku.trim().toUpperCase(),
    nome: dados.value.nome.trim(),
    descricao: dados.value.descricao.trim(),
    marca: dados.value.marca.trim(),
    subtipo: dados.value.subtipo,
    preco: dados.value.preco.trim(),
    ativo: dados.value.ativo,
    puffs: puffs === null ? null : Number(puffs),
    volume_ml: especificacao('volume_ml'),
    nicotina_mg_ml: especificacao('nicotina_mg_ml'),
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

    <CampoSelecao
      v-model="dados.subtipo"
      rotulo="Subtipo"
      obrigatorio
      :erro="campos?.subtipo"
      :desabilitado="enviando"
      dica="A categoria vem do subtipo escolhido."
    >
      <option v-for="item in subtipos" :key="item.slug" :value="item.slug">
        {{ item.categoria_display }} — {{ item.nome }}
      </option>
    </CampoSelecao>

    <CampoAreaDeTexto
      v-model="dados.descricao"
      rotulo="Descrição"
      :maxlength="2000"
      :erro="campos?.descricao"
      :desabilitado="enviando"
    />

    <fieldset v-if="especificacoesDoSubtipo?.size !== 0" class="especificacoes">
      <legend class="especificacoes__titulo">Especificações</legend>
      <p v-if="especificacoesDoSubtipo === null" class="especificacoes__nota">
        Escolha o subtipo para ver só as que valem. O servidor recusa o que não se aplica e cobra o
        que falta.
      </p>

      <div class="tripla">
        <CampoTexto
          v-if="mostra('puffs')"
          v-model="dados.puffs"
          rotulo="Puffs"
          inputmode="numeric"
          :obrigatorio="especificacoesDoSubtipo !== null"
          :erro="campos?.puffs"
          :desabilitado="enviando"
        />
        <CampoTexto
          v-if="mostra('volume_ml')"
          v-model="dados.volume_ml"
          rotulo="Volume (ml)"
          inputmode="numeric"
          :obrigatorio="especificacoesDoSubtipo !== null"
          :erro="campos?.volume_ml"
          :desabilitado="enviando"
        />
        <CampoTexto
          v-if="mostra('nicotina_mg_ml')"
          v-model="dados.nicotina_mg_ml"
          rotulo="Nicotina (mg/ml)"
          inputmode="numeric"
          :obrigatorio="especificacoesDoSubtipo !== null"
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
