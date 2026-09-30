<script setup lang="ts">
/**
 * Cadastro e edição de produto na mesma tela.
 *
 * O que separa os dois é haver ou não um id na rota: a diferença está em qual
 * chamada sai no fim, não em duas telas quase iguais.
 */
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import { useRequisicao } from '@/composables/useRequisicao'
import { listarSubtipos } from '@/modules/loja/services/catalogo'
import FormularioDeProduto from '../components/FormularioDeProduto.vue'
import { atualizarProduto, buscarProduto, criarProduto } from '../services/produtos'
import type { DadosDeProduto } from '../types'

const rota = useRoute()
const router = useRouter()

const id = computed(() => (rota.params.id ? String(rota.params.id) : null))
const editando = computed(() => id.value !== null)

const subtipos = useRequisicao(listarSubtipos)
const produto = useRequisicao(() => buscarProduto(id.value as string), { imediato: editando.value })

const pendente = ref<DadosDeProduto | null>(null)

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  const dados = pendente.value as DadosDeProduto
  const salvo = editando.value
    ? await atualizarProduto(id.value as string, dados)
    : await criarProduto(dados)
  await router.push({ name: 'admin-produto', params: { id: salvo.id } })
})

function salvar(dados: DadosDeProduto): void {
  pendente.value = dados
  void submeter()
}

const carregando = computed(
  () => subtipos.carregando.value || (editando.value && produto.carregando.value),
)

const falhaAoCarregar = computed(() => subtipos.erro.value ?? produto.erro.value)
</script>

<template>
  <header class="topo">
    <RouterLink to="/admin/produtos" class="topo__voltar">Produtos</RouterLink>
    <h1 class="topo__titulo">{{ editando ? 'Editar produto' : 'Cadastrar produto' }}</h1>
  </header>

  <CarregandoIndicador v-if="carregando" texto="Carregando o formulário" />

  <MensagemDeErro
    v-else-if="falhaAoCarregar"
    :erro="falhaAoCarregar"
    @repetir="editando ? produto.executar() : subtipos.executar()"
  />

  <template v-else>
    <MensagemDeErro v-if="erro" :erro="erro" sem-repetir class="recusa" />

    <FormularioDeProduto
      :subtipos="subtipos.dados.value ?? []"
      :valor-inicial="produto.dados.value"
      :enviando="enviando"
      :campos="campos"
      :texto-do-botao="editando ? 'Salvar alterações' : 'Cadastrar produto'"
      @enviar="salvar"
    >
      <template #acoes>
        <BotaoBase variante="secundario" @click="router.push('/admin/produtos')">
          Cancelar
        </BotaoBase>
      </template>
    </FormularioDeProduto>
  </template>
</template>

<style scoped>
.topo {
  margin-bottom: var(--e5);
}

.topo__voltar {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.topo__titulo {
  margin-top: var(--e2);
  font-size: var(--texto-xl);
  font-stretch: 85%;
}

.recusa {
  margin-bottom: var(--e4);
  max-width: 38rem;
}
</style>
