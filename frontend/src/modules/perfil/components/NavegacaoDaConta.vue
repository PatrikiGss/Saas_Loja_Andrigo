<script setup lang="ts">
/**
 * Navegação entre as telas da conta.
 *
 * As três são o mesmo assunto visto de ângulos diferentes, então dividem um
 * cabeçalho em vez de cada uma se anunciar como página solta.
 */
import { RouterLink } from 'vue-router'

const secoes = [
  { rota: '/conta', texto: 'Dados pessoais' },
  { rota: '/conta/enderecos', texto: 'Endereços' },
  { rota: '/conta/senha', texto: 'Senha' },
]
</script>

<template>
  <div class="conta">
    <h1 class="conta__titulo">Minha conta</h1>

    <nav aria-label="Seções da conta">
      <ul class="abas">
        <li v-for="secao in secoes" :key="secao.rota">
          <!-- `exact` na primeira: sem isso, /conta ficaria ativa também em
               /conta/enderecos, porque uma é prefixo da outra. -->
          <RouterLink
            class="abas__link"
            :to="secao.rota"
            :exact-active-class="'abas__link--ativo'"
            :active-class="secao.rota === '/conta' ? '' : 'abas__link--ativo'"
          >
            {{ secao.texto }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>

<style scoped>
.conta__titulo {
  font-size: var(--texto-2xl);
  font-stretch: 85%;
  margin-bottom: var(--e5);
}

.abas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e5);
  list-style: none;
  padding: 0;
  margin-bottom: var(--e6);
  border-bottom: 1px solid var(--linha);
}

.abas__link {
  display: inline-block;
  padding-bottom: var(--e3);
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  font-size: var(--texto-sm);
  color: var(--tinta-media);
  text-decoration: none;
}

.abas__link:hover {
  color: var(--tinta);
}

.abas__link--ativo {
  color: var(--tinta);
  font-weight: 700;
  border-bottom-color: var(--tinta);
}
</style>
