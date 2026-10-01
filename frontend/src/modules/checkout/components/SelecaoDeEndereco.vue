<script setup lang="ts">
/**
 * Escolha do endereço de entrega.
 *
 * Quem ainda não tem endereço cai direto no formulário, sem uma lista vazia
 * no meio do caminho.
 */
import { computed, ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import FormularioDeEndereco from '@/modules/enderecos/components/FormularioDeEndereco.vue'
import { criarEndereco } from '@/modules/enderecos/services/enderecos'
import type { DadosDeEndereco, Endereco } from '@/modules/enderecos/types'
import { cep as formatarCep } from '@/utils/formato'
import OpcaoEmCartao from './OpcaoEmCartao.vue'

const props = defineProps<{
  enderecos: Endereco[]
  selecionado: number | null
}>()

const emit = defineEmits<{
  escolher: [id: number]
  criado: [endereco: Endereco]
  continuar: []
}>()

const cadastrando = ref(props.enderecos.length === 0)
const novoEndereco = ref<DadosDeEndereco | null>(null)

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  const criado = await criarEndereco(novoEndereco.value as DadosDeEndereco)
  emit('criado', criado)
  cadastrando.value = false
  return criado
})

function salvar(dados: DadosDeEndereco): void {
  novoEndereco.value = dados
  void submeter()
}

const temEnderecos = computed(() => props.enderecos.length > 0)

function linhaDoEndereco(endereco: Endereco): string {
  const complemento = endereco.complemento ? `, ${endereco.complemento}` : ''
  return `${endereco.logradouro}, ${endereco.numero}${complemento}`
}
</script>

<template>
  <section>
    <h2 class="titulo">Para onde entregamos?</h2>

    <div v-if="temEnderecos && !cadastrando" class="lista">
      <OpcaoEmCartao
        v-for="endereco in enderecos"
        :key="endereco.id"
        nome="endereco"
        :valor="endereco.id"
        :escolhida="selecionado === endereco.id"
        @escolher="emit('escolher', endereco.id)"
      >
        <span class="opcao__texto">
          <span v-if="endereco.apelido" class="opcao__apelido">{{ endereco.apelido }}</span>
          <span class="opcao__linha">{{ linhaDoEndereco(endereco) }}</span>
          <span class="opcao__linha opcao__linha--fraca">
            {{ endereco.bairro }} — {{ endereco.cidade }}/{{ endereco.uf }}
          </span>
          <span class="opcao__linha opcao__linha--fraca numerico">
            CEP {{ formatarCep(endereco.cep) }}
          </span>
        </span>
      </OpcaoEmCartao>

      <div class="acoes">
        <BotaoBase :desabilitado="selecionado === null" @click="emit('continuar')">
          Continuar
        </BotaoBase>
        <BotaoBase variante="secundario" @click="cadastrando = true">
          Usar outro endereço
        </BotaoBase>
      </div>
    </div>

    <div v-else class="cadastro">
      <MensagemDeErro v-if="erro" :erro="erro" sem-repetir />

      <FormularioDeEndereco
        :enviando="enviando"
        :campos="campos"
        texto-do-botao="Usar este endereço"
        @enviar="salvar"
      >
        <template v-if="temEnderecos" #acoes>
          <BotaoBase variante="secundario" @click="cadastrando = false">Cancelar</BotaoBase>
        </template>
      </FormularioDeEndereco>
    </div>
  </section>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-lg);
  margin-bottom: var(--e4);
}

.lista {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  max-width: 34rem;
}

.opcao__texto {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  font-size: var(--texto-sm);
}

.opcao__apelido {
  font-weight: 700;
}

.opcao__linha--fraca {
  color: var(--tinta-media);
}

.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  margin-top: var(--e2);
}

.cadastro {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
</style>
