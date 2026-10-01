<script setup lang="ts">
/**
 * Destino e serviço de entrega.
 *
 * Recebe as partes, e não o pedido, porque também desenha o resumo antes do
 * fechamento, quando o destino ainda é o endereço do cadastro e o serviço é a
 * opção cotada. Depois do fechamento, o endereço é a cópia guardada no
 * pedido: mudar o cadastro não mexe no que foi comprado.
 */
import { cep as formatarCep } from '@/utils/formato'
import type { EnderecoDeEntrega } from '../types'

defineProps<{
  endereco: EnderecoDeEntrega
  /** Nome legível do serviço: 'Econômico', 'Expresso'. */
  servico: string
  prazoEmDias: number
}>()
</script>

<template>
  <div>
    <p class="endereco">
      {{ endereco.logradouro }}, {{ endereco.numero }}<br />
      <template v-if="endereco.complemento">{{ endereco.complemento }}<br /></template>
      {{ endereco.bairro }} — {{ endereco.cidade }}/{{ endereco.uf }}<br />
      <span class="numerico">CEP {{ formatarCep(endereco.cep) }}</span>
    </p>

    <p class="servico">
      {{ servico }}, em até
      <span class="numerico">{{ prazoEmDias }}</span>
      {{ prazoEmDias === 1 ? 'dia útil' : 'dias úteis' }}
    </p>
  </div>
</template>

<style scoped>
.endereco,
.servico {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
  line-height: 1.5;
}

.endereco {
  margin-top: var(--e3);
}

.servico {
  margin-top: var(--e3);
}
</style>
