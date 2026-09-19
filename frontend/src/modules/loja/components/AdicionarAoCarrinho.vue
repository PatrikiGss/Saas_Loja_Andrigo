<script setup lang="ts">
/**
 * Quantidade e inclusão no carrinho.
 *
 * Quem não entrou é mandado para o login guardando o caminho de volta — isso
 * é conveniência, não proteção: o endpoint do carrinho exige autenticação no
 * servidor, e continuaria exigindo se este botão não existisse.
 *
 * Estoque e disponibilidade também são decisão do backend. A tela manda
 * produto e quantidade, e mostra o que a API responder.
 */
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useSessao } from '@/modules/auth/stores/sessao'
import { useCarrinho } from '@/modules/carrinho/stores/carrinho'
import { QUANTIDADE_MAXIMA } from '@/modules/carrinho/types'
import type { Produto } from '../types'

const props = defineProps<{ produto: Produto }>()

const rota = useRoute()
const router = useRouter()
const sessao = useSessao()
// Pela store, e não pelo serviço direto: é o que mantém a contagem do
// cabeçalho e a página do carrinho falando a mesma coisa.
const carrinho = useCarrinho()

const quantidade = ref(1)
const adicionado = ref(false)
const erro = computed(() => carrinho.erro)

/** Primeira mensagem útil entre os campos que o backend recusou. */
const recusa = computed(() => erro.value?.campos.produto ?? erro.value?.campos.quantidade)

async function adicionar(): Promise<void> {
  if (!sessao.autenticado) {
    void router.push({ name: 'entrar', query: { destino: rota.fullPath } })
    return
  }

  adicionado.value = false
  const falha = await carrinho.adicionar(props.produto.id, quantidade.value)
  adicionado.value = falha === null
}
</script>

<template>
  <div class="adicionar">
    <p v-if="!produto.em_estoque" class="adicionar__esgotado">
      Este produto está sem estoque no momento.
    </p>

    <template v-else>
      <div class="adicionar__controles">
        <label class="quantidade">
          <span class="quantidade__rotulo">Quantidade</span>
          <input
            v-model.number="quantidade"
            class="quantidade__campo numerico"
            type="number"
            inputmode="numeric"
            min="1"
            :max="QUANTIDADE_MAXIMA"
            :disabled="carrinho.salvando"
          />
        </label>

        <BotaoBase :carregando="carrinho.salvando" @click="adicionar">
          Adicionar ao carrinho
        </BotaoBase>
      </div>

      <p v-if="adicionado" class="adicionar__confirmado" role="status">
        Adicionado ao carrinho.
        <RouterLink to="/carrinho">Ver carrinho</RouterLink>
      </p>

      <MensagemDeErro v-if="erro" :erro="erro" :detalhe="recusa" sem-repetir />
    </template>
  </div>
</template>

<style scoped>
.adicionar {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}

.adicionar__controles {
  display: flex;
  align-items: flex-end;
  gap: var(--e3);
  flex-wrap: wrap;
}

.quantidade {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}

.quantidade__rotulo {
  font-size: var(--texto-xs);
  font-weight: 600;
  color: var(--tinta-media);
}

.quantidade__campo {
  width: 4.5rem;
  min-height: 2.75rem;
  padding: 0 var(--e2);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
}

.adicionar__confirmado {
  padding-left: var(--e3);
  border-left: 3px solid var(--tinta);
  font-size: var(--texto-sm);
  font-weight: 600;
}

.adicionar__esgotado {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}
</style>
