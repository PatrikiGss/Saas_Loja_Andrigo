<script setup lang="ts">
/**
 * Endereços da conta.
 *
 * Apagar um endereço não mexe em pedido nenhum: o pedido guarda uma cópia
 * própria do destino, em tabela separada, e a referência ao cadastro é
 * `SET_NULL`. Por isso a remoção é oferecida sem ressalva — mas com
 * confirmação, porque não dá para desfazer.
 */
import { computed, ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import { useRequisicao } from '@/composables/useRequisicao'
import FormularioDeEndereco from '@/modules/enderecos/components/FormularioDeEndereco.vue'
import {
  atualizarEndereco,
  criarEndereco,
  listarEnderecos,
  removerEndereco,
} from '@/modules/enderecos/services/enderecos'
import type { DadosDeEndereco, Endereco } from '@/modules/enderecos/types'
import { cep as formatarCep } from '@/utils/formato'
import NavegacaoDaConta from '../components/NavegacaoDaConta.vue'

const { dados: enderecos, carregando, erro, executar, vazio } = useRequisicao(listarEnderecos)

/** Nada, um endereço sendo editado, ou 'novo'. */
const emEdicao = ref<Endereco | 'novo' | null>(null)
const paraRemover = ref<Endereco | null>(null)

const pendentes = ref<DadosDeEndereco | null>(null)

const {
  enviando,
  erro: erroAoSalvar,
  campos,
  submeter,
  limpar: limparErros,
} = useFormulario(async () => {
  const dados = pendentes.value as DadosDeEndereco
  if (emEdicao.value === 'novo' || emEdicao.value === null) {
    await criarEndereco(dados)
  } else {
    await atualizarEndereco(emEdicao.value.id, dados)
  }
  emEdicao.value = null
  await executar()
})

function salvar(dados: DadosDeEndereco): void {
  pendentes.value = dados
  void submeter()
}

function abrir(alvo: Endereco | 'novo'): void {
  limparErros()
  emEdicao.value = alvo
}

const {
  enviando: removendo,
  erro: erroAoRemover,
  submeter: confirmarRemocao,
} = useFormulario(async () => {
  await removerEndereco((paraRemover.value as Endereco).id)
  paraRemover.value = null
  await executar()
})

const editando = computed(() =>
  emEdicao.value === 'novo' || emEdicao.value === null ? null : emEdicao.value,
)

function linha(endereco: Endereco): string {
  const complemento = endereco.complemento ? `, ${endereco.complemento}` : ''
  return `${endereco.logradouro}, ${endereco.numero}${complemento}`
}
</script>

<template>
  <NavegacaoDaConta />

  <CarregandoIndicador v-if="carregando" texto="Carregando seus endereços" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <div v-else class="conteudo">
    <template v-if="emEdicao !== null">
      <h2 class="titulo">
        {{ editando ? 'Editar endereço' : 'Novo endereço' }}
      </h2>

      <MensagemDeErro v-if="erroAoSalvar" :erro="erroAoSalvar" sem-repetir class="recusa" />

      <FormularioDeEndereco
        :key="editando?.id ?? 'novo'"
        :valor-inicial="editando"
        :enviando="enviando"
        :campos="campos"
        texto-do-botao="Salvar endereço"
        @enviar="salvar"
      >
        <template #acoes>
          <BotaoBase variante="secundario" @click="emEdicao = null">Cancelar</BotaoBase>
        </template>
      </FormularioDeEndereco>
    </template>

    <template v-else>
      <EstadoVazio
        v-if="vazio"
        titulo="Nenhum endereço cadastrado"
        descricao="Cadastre um endereço para fechar seus pedidos mais rápido."
      >
        <template #acao>
          <BotaoBase @click="abrir('novo')">Cadastrar endereço</BotaoBase>
        </template>
      </EstadoVazio>

      <template v-else>
        <MensagemDeErro v-if="erroAoRemover" :erro="erroAoRemover" sem-repetir class="recusa" />

        <ul class="lista">
          <li v-for="endereco in enderecos ?? []" :key="endereco.id" class="cartao">
            <div class="cartao__dados">
              <p v-if="endereco.apelido" class="cartao__apelido">{{ endereco.apelido }}</p>
              <p class="cartao__linha">{{ linha(endereco) }}</p>
              <p class="cartao__linha cartao__linha--fraca">
                {{ endereco.bairro }} — {{ endereco.cidade }}/{{ endereco.uf }}
              </p>
              <p class="cartao__linha cartao__linha--fraca numerico">
                CEP {{ formatarCep(endereco.cep) }}
              </p>
            </div>

            <div class="cartao__acoes">
              <BotaoBase variante="secundario" @click="abrir(endereco)">Editar</BotaoBase>
              <BotaoBase variante="discreto" @click="paraRemover = endereco">Remover</BotaoBase>
            </div>
          </li>
        </ul>

        <BotaoBase class="novo" variante="secundario" @click="abrir('novo')">
          Cadastrar outro endereço
        </BotaoBase>
      </template>
    </template>

    <DialogoDeConfirmacao
      :aberto="paraRemover !== null"
      titulo="Remover este endereço?"
      descricao="Ele sai do seu cadastro. Os pedidos já feitos guardam o endereço de entrega deles e não mudam."
      confirmar="Remover endereço"
      :processando="removendo"
      @confirmar="confirmarRemocao"
      @cancelar="paraRemover = null"
    />
  </div>
</template>

<style scoped>
.conteudo {
  max-width: 34rem;
}

.titulo {
  font-size: var(--texto-lg);
  margin-bottom: var(--e4);
}

.recusa {
  margin-bottom: var(--e4);
}

.lista {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  list-style: none;
  padding: 0;
}

.cartao {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e4);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-superficie);
}

.cartao__apelido {
  font-weight: 700;
  font-size: var(--texto-sm);
}

.cartao__linha {
  font-size: var(--texto-sm);
}

.cartao__linha--fraca {
  color: var(--tinta-media);
}

.cartao__acoes {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  flex: none;
}

.novo {
  margin-top: var(--e4);
}

@media (max-width: 30rem) {
  .cartao {
    flex-direction: column;
  }

  .cartao__acoes {
    flex-direction: row;
  }
}
</style>
