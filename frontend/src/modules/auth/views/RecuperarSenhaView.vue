<script setup lang="ts">
/**
 * Pedido do link de recuperação.
 *
 * O backend responde igual exista ou não a conta, para o endpoint não servir
 * de lista de quem tem cadastro. A tela mantém esse silêncio: a confirmação
 * não afirma que o e-mail existe.
 */
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import AvisoDeSucesso from '../components/AvisoDeSucesso.vue'
import PaginaDeAutenticacao from '../components/PaginaDeAutenticacao.vue'
import { pedirRecuperacao } from '../services/auth'

const email = ref('')
const pedido = ref(false)

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  await pedirRecuperacao(email.value)
  pedido.value = true
})
</script>

<template>
  <PaginaDeAutenticacao
    v-if="pedido"
    titulo="Verifique seu e-mail"
  >
    <AvisoDeSucesso
      titulo="Pedido registrado"
      :descricao="`Se houver uma conta ativa com ${email}, o link de redefinição chega em instantes. O link vale uma vez e expira.`"
    />

    <template #rodape>
      <p><RouterLink to="/entrar">Voltar para entrar</RouterLink></p>
    </template>
  </PaginaDeAutenticacao>

  <PaginaDeAutenticacao
    v-else
    titulo="Recuperar senha"
    descricao="Informe o e-mail da conta e enviamos um link para você escolher uma senha nova."
  >
    <form class="campos" novalidate @submit.prevent="submeter">
      <CampoTexto
        v-model="email"
        rotulo="E-mail"
        tipo="email"
        autocomplete="email"
        obrigatorio
        :erro="campos.email"
      />

      <MensagemDeErro v-if="erro" :erro="erro" sem-repetir />

      <BotaoBase tipo="submit" :carregando="enviando" largura-total>
        Enviar link de recuperação
      </BotaoBase>
    </form>

    <template #rodape>
      <p><RouterLink to="/entrar">Lembrei a senha</RouterLink></p>
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
