<script setup lang="ts">
/**
 * Pedido criado.
 *
 * Todos os números aqui vêm da resposta do fechamento: são os que o servidor
 * gravou, e não a soma que o resumo mostrava. Se as duas não baterem, a que
 * vale é esta.
 *
 * As peças são as mesmas da página do pedido, e por isso vêm do módulo
 * `pedidos`: esta tela e aquela mostram a mesma compra, em dois momentos.
 */
import { RouterLink } from 'vue-router'

import AvisoDePagamento from '@/modules/pedidos/components/AvisoDePagamento.vue'
import EntregaDoPedido from '@/modules/pedidos/components/EntregaDoPedido.vue'
import ItensDoPedido from '@/modules/pedidos/components/ItensDoPedido.vue'
import ValoresDoPedido from '@/modules/pedidos/components/ValoresDoPedido.vue'
import type { Pedido } from '@/modules/pedidos/types'

defineProps<{ pedido: Pedido }>()
</script>

<template>
  <section class="confirmado">
    <h1 class="confirmado__titulo">Pedido registrado</h1>

    <p class="confirmado__numero">
      Número <span class="numerico">{{ pedido.numero }}</span>
    </p>

    <AvisoDePagamento :pedido="pedido" class="confirmado__aviso" />

    <ValoresDoPedido :pedido="pedido" class="confirmado__valores" />

    <div class="blocos">
      <div>
        <h2 class="bloco__nome">Itens</h2>
        <ItensDoPedido :itens="pedido.itens" />
      </div>

      <div>
        <h2 class="bloco__nome">Entrega</h2>
        <EntregaDoPedido :pedido="pedido" />
      </div>
    </div>

    <div class="saidas">
      <RouterLink :to="{ name: 'pedido', params: { numero: pedido.numero } }" class="saida">
        Acompanhar este pedido
      </RouterLink>
      <RouterLink to="/catalogo" class="saida saida--fraca">Voltar para o catálogo</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.confirmado__titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
}

.confirmado__numero {
  margin-top: var(--e2);
  font-size: var(--texto-md);
  color: var(--tinta-media);
}

.confirmado__aviso {
  margin: var(--e5) 0;
}

.confirmado__valores {
  margin-bottom: var(--e6);
}

.blocos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--e6);
  max-width: 44rem;
}

.bloco__nome {
  font-size: var(--texto-sm);
  font-weight: 700;
  padding-bottom: var(--e2);
  border-bottom: 1px solid var(--linha);
}

.saidas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e5);
  margin-top: var(--e7);
}

.saida {
  font-weight: 600;
}

.saida--fraca {
  color: var(--tinta-media);
  font-weight: 500;
}
</style>
