<script setup lang="ts">
/**
 * Reposição e baixa de estoque.
 *
 * O endpoint recebe um delta com sinal, mas pedir para alguém digitar um
 * menos é convite a erro caro: a tela pergunta a quantidade e são os dois
 * botões que decidem o sinal.
 *
 * A conta é do banco, em uma consulta condicional: duas baixas simultâneas
 * não derrubam o estoque abaixo de zero, e a baixa maior que o disponível
 * volta recusada.
 */
import { ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import { deErro, type ErroDaApi } from '@/services/erros'
import { ajustarEstoque } from '../services/produtos'

const props = defineProps<{ id: string; estoque: number }>()
const emit = defineEmits<{ ajustado: [estoque: number] }>()

const quantidade = ref(1)
const salvando = ref(false)
const erro = ref<ErroDaApi | null>(null)

async function aplicar(sinal: 1 | -1): Promise<void> {
  const delta = Math.trunc(quantidade.value) * sinal
  if (salvando.value || !Number.isFinite(delta) || delta === 0) {
    return
  }

  salvando.value = true
  erro.value = null
  try {
    emit('ajustado', await ajustarEstoque(props.id, delta))
  } catch (falha) {
    erro.value = deErro(falha)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="ajuste">
    <div class="ajuste__controles">
      <label>
        <span class="apenas-leitor">Quantidade para ajustar o estoque</span>
        <input
          v-model.number="quantidade"
          class="ajuste__campo numerico"
          type="number"
          inputmode="numeric"
          min="1"
          :disabled="salvando"
        />
      </label>

      <BotaoBase variante="secundario" :carregando="salvando" @click="aplicar(1)">
        Repor
      </BotaoBase>
      <BotaoBase variante="secundario" :desabilitado="salvando" @click="aplicar(-1)">
        Dar baixa
      </BotaoBase>
    </div>

    <p v-if="erro" class="ajuste__erro" role="alert">
      {{ erro.campos.delta ?? erro.message }}
    </p>
  </div>
</template>

<style scoped>
.ajuste__controles {
  display: flex;
  align-items: center;
  gap: var(--e2);
}

.ajuste__campo {
  width: 4rem;
  min-height: 2.25rem;
  padding: 0 var(--e2);
  text-align: center;
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-sm);
}

.ajuste__controles :deep(.botao) {
  min-height: 2.25rem;
  padding: 0 var(--e3);
  font-size: var(--texto-xs);
}

.ajuste__erro {
  margin-top: var(--e2);
  font-size: var(--texto-xs);
  color: var(--alerta);
}
</style>
