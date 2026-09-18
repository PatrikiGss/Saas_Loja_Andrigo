<script setup lang="ts">
/**
 * Criação de conta.
 *
 * A conta nasce desativada no backend e só funciona depois que a pessoa
 * confirma o e-mail, então a tela termina em instrução, não em login.
 */
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import AvisoDeSucesso from '../components/AvisoDeSucesso.vue'
import PaginaDeAutenticacao from '../components/PaginaDeAutenticacao.vue'
import { cadastrar } from '../services/auth'

const nome = ref('')
const email = ref('')
const senha = ref('')
const cadastrado = ref(false)

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  await cadastrar({ nome: nome.value, email: email.value, password: senha.value })
  cadastrado.value = true
})
</script>

<template>
  <PaginaDeAutenticacao v-if="cadastrado" titulo="Confirme seu e-mail">
    <AvisoDeSucesso
      titulo="Conta criada"
      :descricao="`Enviamos um link de confirmação para ${email}. A conta passa a funcionar depois que você abrir esse link.`"
    />

    <template #rodape>
      <p>Já confirmou? <RouterLink to="/entrar">Entrar</RouterLink></p>
    </template>
  </PaginaDeAutenticacao>

  <PaginaDeAutenticacao v-else titulo="Criar conta">
    <form class="campos" novalidate @submit.prevent="submeter">
      <CampoTexto
        v-model="nome"
        rotulo="Nome"
        autocomplete="given-name"
        :maxlength="150"
        :erro="campos.nome"
      />

      <CampoTexto
        v-model="email"
        rotulo="E-mail"
        tipo="email"
        autocomplete="email"
        obrigatorio
        dica="É com ele que você vai entrar."
        :erro="campos.email"
      />

      <CampoTexto
        v-model="senha"
        rotulo="Senha"
        tipo="password"
        autocomplete="new-password"
        obrigatorio
        dica="Pelo menos 8 caracteres, e nada de senha comum."
        :erro="campos.password"
      />

      <MensagemDeErro v-if="erro" :erro="erro" sem-repetir />

      <BotaoBase tipo="submit" :carregando="enviando" largura-total>Criar conta</BotaoBase>
    </form>

    <template #rodape>
      <p>Já tem conta? <RouterLink to="/entrar">Entrar</RouterLink></p>
    </template>
  </PaginaDeAutenticacao>
</template>

<style scoped>
.campos {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
</style>
