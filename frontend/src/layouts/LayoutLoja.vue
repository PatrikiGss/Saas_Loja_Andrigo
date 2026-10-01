<script setup lang="ts">
/**
 * Moldura da área do cliente: barra, conteúdo e rodapé.
 *
 * O canto direito da barra é o lugar da conta: quem está logado, e a saída.
 * A navegação é uma lista aqui dentro porque cada etapa do projeto acrescenta
 * uma rota; assim entrar no menu é uma linha, e não uma edição de marcação.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { IDADE_MINIMA, NOME_DA_LOJA } from '@/app/config'
import BotaoBase from '@/components/BotaoBase.vue'
import { useSair } from '@/modules/auth/sair'
import { useSessao } from '@/modules/auth/stores/sessao'
import { useCarrinho } from '@/modules/carrinho/stores/carrinho'

interface ItemDeNavegacao {
  rota: string
  texto: string
}

/**
 * Cresce conforme as rotas existem de verdade.
 *
 * Pedidos só entra para quem entrou: a rota exige autenticação, e oferecer o
 * link a um visitante seria mandá-lo para o login sem ele ter pedido nada.
 */
const navegacao = computed<ItemDeNavegacao[]>(() => [
  { rota: '/catalogo', texto: 'Catálogo' },
  ...(sessao.autenticado ? [{ rota: '/pedidos', texto: 'Pedidos' }] : []),
  // Atalho para a gestão. Esconder não é proteção: o backend recusa quem não
  // é admin de qualquer forma. Aqui é só não oferecer o que não serve.
  ...(sessao.ehAdmin ? [{ rota: '/admin/produtos', texto: 'Gestão' }] : []),
])

const sessao = useSessao()
const carrinho = useCarrinho()
const { saindo, sair } = useSair()
</script>

<template>
  <div class="moldura">
    <a class="pular apenas-leitor" href="#conteudo">Pular para o conteúdo</a>

    <header class="barra">
      <div class="barra__interno">
        <RouterLink to="/" class="marca">{{ NOME_DA_LOJA }}</RouterLink>

        <nav v-if="navegacao.length" aria-label="Principal">
          <ul class="menu">
            <li v-for="item in navegacao" :key="item.rota">
              <RouterLink class="menu__link" :to="item.rota">{{ item.texto }}</RouterLink>
            </li>
          </ul>
        </nav>

        <div class="conta">
          <template v-if="sessao.autenticado">
            <!-- Só para quem entrou: o carrinho existe por conta no backend,
                 e um visitante não tem carrinho para ver. -->
            <RouterLink class="conta__carrinho" to="/carrinho">
              Carrinho
              <span v-if="carrinho.quantidadeTotal" class="conta__contagem numerico">
                {{ carrinho.quantidadeTotal }}
                <span class="apenas-leitor">
                  {{ carrinho.quantidadeTotal === 1 ? 'item' : 'itens' }}
                </span>
              </span>
            </RouterLink>

            <RouterLink class="conta__nome" to="/conta" :title="sessao.usuario?.email">
              {{ sessao.nomeExibido }}
            </RouterLink>
            <BotaoBase variante="discreto" :carregando="saindo" @click="sair">Sair</BotaoBase>
          </template>

          <RouterLink v-else class="conta__entrar" to="/entrar">Entrar</RouterLink>
        </div>
      </div>
    </header>

    <main id="conteudo" class="conteudo">
      <slot />
    </main>

    <footer class="rodape">
      <p class="rodape__texto">Venda proibida para menores de {{ IDADE_MINIMA }} anos.</p>
    </footer>
  </div>
</template>

<style scoped>
.moldura {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.pular:focus {
  position: fixed;
  top: var(--e3);
  left: var(--e3);
  z-index: 10;
  width: auto;
  height: auto;
  padding: var(--e2) var(--e3);
  clip-path: none;
  background: var(--tinta);
  color: var(--papel-alto);
  border-radius: var(--raio-controle);
}

.barra {
  border-bottom: 1px solid var(--linha);
  background: var(--papel);
}

.barra__interno,
.conteudo,
.rodape__texto {
  width: 100%;
  max-width: var(--largura-conteudo);
  margin-inline: auto;
  padding-inline: var(--medianiz);
}

.barra__interno {
  display: flex;
  align-items: center;
  gap: var(--e5);
  min-height: 3.75rem;
}

.marca {
  font-size: var(--texto-md);
  font-weight: 800;
  font-stretch: 80%;
  letter-spacing: -0.01em;
  text-decoration: none;
  white-space: nowrap;
}

.menu {
  display: flex;
  gap: var(--e5);
  list-style: none;
  padding: 0;
}

.menu__link {
  font-size: var(--texto-sm);
  font-weight: 500;
  color: var(--tinta-media);
  text-decoration: none;
}

.menu__link:hover,
.menu__link.router-link-active {
  color: var(--tinta);
}

/* Empurra a conta para o extremo direito, com menu ou sem menu. */
.conta {
  display: flex;
  align-items: center;
  gap: var(--e3);
  margin-left: auto;
  min-width: 0;
}

.conta__nome {
  font-size: var(--texto-sm);
  font-weight: 600;
  text-decoration: none;
  /* Nome comprido encolhe em vez de empurrar o botão de sair para fora. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conta__nome:hover {
  text-decoration: underline;
}

.conta__entrar,
.conta__carrinho {
  font-size: var(--texto-sm);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.conta__entrar:hover,
.conta__carrinho:hover {
  text-decoration: underline;
}

.conta__carrinho {
  display: inline-flex;
  align-items: center;
  gap: var(--e2);
}

/* O único lugar arredondado de ponta a ponta na interface: uma contagem
   pequena dentro de um texto. */
.conta__contagem {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 var(--e1);
  background: var(--tinta);
  color: var(--papel-alto);
  border-radius: var(--raio-pilula);
  font-size: var(--texto-2xs);
  font-weight: 700;
}

.conteudo {
  flex: 1;
  padding-block: var(--e7) var(--e9);
}

.rodape {
  border-top: 1px solid var(--linha);
  padding-block: var(--e5);
}

.rodape__texto {
  font-size: var(--texto-xs);
  color: var(--tinta-media);
  margin: 0;
}

/* No celular a barra não cabe em uma linha: marca, menu, carrinho, nome e
   saída disputavam a mesma faixa e o nome era espremido até uma letra. A
   marca fica sozinha em cima e o resto desce para a segunda linha. */
@media (max-width: 40rem) {
  .barra__interno {
    flex-wrap: wrap;
    row-gap: var(--e2);
    padding-block: var(--e3);
  }

  .marca {
    flex: 0 0 100%;
  }

  .conta {
    gap: var(--e4);
  }

  .conta__nome {
    max-width: 9rem;
  }
}
</style>
