<script setup lang="ts">
/**
 * Destino e serviço de entrega.
 *
 * O endereço é a cópia guardada no fechamento, em tabela própria: mudar o
 * cadastro depois não mexe no que foi comprado.
 */
import { cep as formatarCep } from '@/utils/formato'
import { textoDoServico, type Pedido } from '../types'

defineProps<{ pedido: Pedido }>()
</script>

<template>
  <div>
    <p class="endereco">
      {{ pedido.entrega.logradouro }}, {{ pedido.entrega.numero }}<br />
      <template v-if="pedido.entrega.complemento">
        {{ pedido.entrega.complemento }}<br />
      </template>
      {{ pedido.entrega.bairro }} — {{ pedido.entrega.cidade }}/{{ pedido.entrega.uf }}<br />
      <span class="numerico">CEP {{ formatarCep(pedido.entrega.cep) }}</span>
    </p>

    <p class="servico">
      {{ textoDoServico(pedido.servico_frete) }}, em até
      <span class="numerico">{{ pedido.prazo_frete_em_dias }}</span>
      {{ pedido.prazo_frete_em_dias === 1 ? 'dia útil' : 'dias úteis' }}
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
