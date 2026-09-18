<script setup lang="ts">
/** Entrada na conta. O refresh fica no cookie; aqui não se guarda token. */
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import PaginaDeAutenticacao from '../components/PaginaDeAutenticacao.vue'
import { destinoSeguro } from '../destino'
import { useSessao } from '../stores/sessao'

const rota = useRoute()
const router = useRouter()
const sessao = useSessao()

const email = ref('')
const senha = ref('')

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  await sessao.entrar({ email: email.value, password: senha.value })
  await router.replace(destinoSeguro(rota.query.destino))
})
</script>

<template>
  <PaginaDeAutenticacao titulo="Entrar">
    <form class="campos" novalidate @submit.prevent="submeter">
      <CampoTexto
        v-model="email"
        rotulo="E-mail"
        tipo="email"
        autocomplete="email"
        obrigatorio
        :erro="campos.email"
      />

      <CampoTexto
        v-model="senha"
        rotulo="Senha"
        tipo="password"
        autocomplete="current-password"
        obrigatorio
        :erro="campos.password"
      />

      <MensagemDeErro v-if="erro" :erro="erro" sem-repetir />

      <BotaoBase tipo="submit" :carregando="enviando" largura-total>Entrar</BotaoBase>
    </form>

    <template #rodape>
      <p><RouterLink to="/recuperar-senha">Esqueci minha senha</RouterLink></p>
      <p class="criar">
        Ainda não tem conta? <RouterLink to="/criar-conta">Criar conta</RouterLink>
      </p>
    </template>
  </PaginaDeAutenticacao>
</template>

<style scoped>
.campos {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}

.criar {
  margin-top: var(--e2);
}
</style>
