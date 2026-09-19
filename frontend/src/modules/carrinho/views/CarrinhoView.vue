<script setup lang="ts">
/**
 * Carrinho da conta.
 *
 * Sem bloco de cor: `ProdutoNoCarrinhoSerializer` não devolve a categoria, e
 * inventar uma aqui seria mentir sobre o dado. O carrinho vira uma razão —
 * nomes à esquerda, números à direita — que é a forma certa para conferir uma
 * conta de qualquer jeito.
 */
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import EstadoVazio from '@/components/EstadoVazio.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { moeda } from '@/utils/formato'
import LinhaDoCarrinho from '../components/LinhaDoCarrinho.vue'
import { useCarrinho } from '../stores/carrinho'

const router = useRouter()
const carrinho = useCarrinho()
const confirmandoLimpeza = ref(false)

async function limpar(): Promise<void> {
  await carrinho.limpar()
  confirmandoLimpeza.value = false
}
</script>

<template>
  <h1 class="titulo">Carrinho</h1>

  <CarregandoIndicador
    v-if="carrinho.carregando && !carrinho.carregado"
    texto="Carregando o carrinho"
  />

  <MensagemDeErro
    v-else-if="carrinho.erro && !carrinho.carregado"
    :erro="carrinho.erro"
    @repetir="carrinho.carregar"
  />

  <EstadoVazio
    v-else-if="carrinho.vazio"
    titulo="Seu carrinho está vazio"
    descricao="Escolha um produto no catálogo para começar."
  >
    <template #acao>
      <RouterLink to="/catalogo" class="vazio__link">Ver o catálogo</RouterLink>
    </template>
  </EstadoVazio>

  <template v-else>
    <!-- Erro de alteração fica aqui em cima, sem derrubar a lista: o carrinho
         continua na tela e a pessoa vê o que foi recusado. -->
    <MensagemDeErro v-if="carrinho.erro" :erro="carrinho.erro" sem-repetir class="recusa" />

    <div class="itens">
      <LinhaDoCarrinho
        v-for="item in carrinho.itens"
        :key="item.id"
        :item="item"
        :salvando="carrinho.salvando"
        @alterar-quantidade="carrinho.alterarQuantidade"
        @remover="carrinho.remover"
      />
    </div>

    <div class="rodape">
      <BotaoBase
        variante="discreto"
        :desabilitado="carrinho.salvando"
        @click="confirmandoLimpeza = true"
      >
        Limpar carrinho
      </BotaoBase>

      <div class="resumo">
        <p class="resumo__linha">
          <span>Total</span>
          <span class="resumo__valor numerico" :aria-busy="carrinho.salvando || undefined">
            {{ moeda(carrinho.total) }}
          </span>
        </p>
        <p class="resumo__nota">
          O frete depende do destino e é calculado no próximo passo.
        </p>

        <!-- Produto indisponível barra o fechamento porque o backend recusa o
             checkout com ele no carrinho; avisar aqui evita a viagem perdida. -->
        <BotaoBase
          class="resumo__fechar"
          :desabilitado="carrinho.salvando || carrinho.temIndisponivel"
          largura-total
          @click="router.push('/checkout')"
        >
          Fechar pedido
        </BotaoBase>

        <p v-if="carrinho.temIndisponivel" class="resumo__bloqueio">
          Retire o item indisponível para fechar o pedido.
        </p>
      </div>
    </div>

    <DialogoDeConfirmacao
      :aberto="confirmandoLimpeza"
      titulo="Limpar o carrinho?"
      descricao="Todos os itens saem do carrinho. Não dá para desfazer."
      confirmar="Limpar carrinho"
      :processando="carrinho.salvando"
      @confirmar="limpar"
      @cancelar="confirmandoLimpeza = false"
    />
  </template>
</template>

<style scoped>
.titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
  margin-bottom: var(--e5);
}

.recusa {
  margin-bottom: var(--e5);
}

.itens {
  border-top: 1px solid var(--linha);
}

.rodape {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--e5);
  margin-top: var(--e5);
}

.resumo {
  min-width: 14rem;
}

.resumo__linha {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--e4);
  font-size: var(--texto-md);
  font-weight: 700;
}

.resumo__valor {
  font-size: var(--texto-xl);
}

.resumo__valor[aria-busy='true'] {
  opacity: 0.45;
}

.resumo__nota {
  margin-top: var(--e2);
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.resumo__fechar {
  margin-top: var(--e4);
}

.resumo__bloqueio {
  margin-top: var(--e2);
  font-size: var(--texto-xs);
  color: var(--alerta);
}

.vazio__link {
  font-weight: 600;
}

@media (max-width: 40rem) {
  .rodape {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}
</style>
