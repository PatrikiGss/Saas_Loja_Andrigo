<script setup lang="ts">
/**
 * Moldura da área administrativa.
 *
 * A barra é invertida — papel sobre tinta — para não haver dúvida de que se
 * está nos bastidores. Não é enfeite: é o aviso de que o que se clica aqui
 * afeta o catálogo e as contas de outras pessoas. O conteúdo segue no papel,
 * como no resto da loja.
 *
 * Isto é sinalização, não proteção: quem autoriza cada requisição é o
 * backend, com `EhAdmin`, e ele continuaria recusando se alguém chegasse
 * aqui por outro caminho.
 */
import { RouterLink } from 'vue-router'

import { NOME_DA_LOJA } from '@/app/config'
import { useSair } from '@/modules/auth/sair'
import { useSessao } from '@/modules/auth/stores/sessao'

const sessao = useSessao()
const { saindo, sair } = useSair()

const secoes = [
  { rota: '/admin/produtos', texto: 'Produtos' },
  { rota: '/admin/pedidos', texto: 'Pedidos' },
  { rota: '/admin/usuarios', texto: 'Usuários' },
]
</script>

<template>
  <div class="moldura">
    <a class="pular apenas-leitor" href="#conteudo">Pular para o conteúdo</a>

    <header class="barra">
      <div class="barra__interno">
        <span class="marca">
          {{ NOME_DA_LOJA }}
          <span class="marca__area">gestão</span>
        </span>

        <nav aria-label="Administração">
          <ul class="menu">
            <li v-for="secao in secoes" :key="secao.rota">
              <RouterLink class="menu__link" :to="secao.rota">{{ secao.texto }}</RouterLink>
            </li>
          </ul>
        </nav>

        <div class="conta">
          <RouterLink class="conta__link" to="/">Ver a loja</RouterLink>
          <span class="conta__nome">{{ sessao.nomeExibido }}</span>
          <button type="button" class="conta__sair" :disabled="saindo" @click="sair">Sair</button>
        </div>
      </div>
    </header>

    <main id="conteudo" class="conteudo">
      <slot />
    </main>
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
  background: var(--papel-alto);
  color: var(--tinta);
  border-radius: var(--raio-controle);
}

.barra {
  background: var(--tinta);
  color: var(--papel);
}

.barra__interno,
.conteudo {
  width: 100%;
  max-width: var(--largura-conteudo);
  margin-inline: auto;
  padding-inline: var(--medianiz);
}

.barra__interno {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--e5);
  min-height: 3.25rem;
  padding-block: var(--e2);
}

.marca {
  font-size: var(--texto-sm);
  font-weight: 800;
  font-stretch: 80%;
  white-space: nowrap;
}

/* A área vem pelo peso, e não por um separador entre as duas palavras. */
.marca__area {
  font-weight: 400;
  color: rgb(244 245 242 / 0.65);
}

.menu {
  display: flex;
  gap: var(--e4);
  list-style: none;
  padding: 0;
}

.menu__link {
  font-size: var(--texto-sm);
  color: rgb(244 245 242 / 0.65);
  text-decoration: none;
  white-space: nowrap;
}

.menu__link:hover,
.menu__link.router-link-active {
  color: var(--papel);
}

/* Foco visível também sobre a tinta: o anel de tinta sumiria aqui. */
.barra :focus-visible {
  outline-color: var(--papel);
}

.conta {
  display: flex;
  align-items: center;
  gap: var(--e3);
  margin-left: auto;
  font-size: var(--texto-xs);
}

.conta__link,
.conta__nome {
  color: rgb(244 245 242 / 0.65);
  text-decoration: none;
  white-space: nowrap;
}

.conta__link:hover {
  color: var(--papel);
}

.conta__sair {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: rgb(244 245 242 / 0.65);
  cursor: pointer;
}

.conta__sair:hover:not(:disabled) {
  color: var(--papel);
}

.conteudo {
  flex: 1;
  padding-block: var(--e6) var(--e9);
}
</style>
