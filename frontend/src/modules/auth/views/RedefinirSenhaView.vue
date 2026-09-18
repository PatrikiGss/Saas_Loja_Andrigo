<script setup lang="ts">
/**
 * Nova senha a partir do link de recuperação.
 *
 * Endereço montado pelo backend em `painel/emails.py`:
 * `{FRONTEND_URL}/redefinir-senha/<uid>/<token>/`. A conferência do link é do
 * servidor — aqui não se tenta adivinhar se ele ainda vale.
 */
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import AvisoDeSucesso from '../components/AvisoDeSucesso.vue'
import PaginaDeAutenticacao from '../components/PaginaDeAutenticacao.vue'
import { redefinirSenha } from '../services/auth'

const rota = useRoute()
const router = useRouter()

const senha = ref('')
const confirmacao = ref('')
const redefinida = ref(false)

/** Confere só o que é confortável conferir aqui; a senha em si é do backend. */
const conferenciaLocal = computed(() =>
  confirmacao.value && senha.value !== confirmacao.value
    ? 'As duas senhas precisam ser iguais.'
    : undefined,
)

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  await redefinirSenha(
    { uid: String(rota.params.uid), token: String(rota.params.token) },
    senha.value,
  )
  redefinida.value = true
})

function enviar() {
  if (conferenciaLocal.value) {
    return
  }
  void submeter()
}
</script>

<template>
  <PaginaDeAutenticacao v-if="redefinida" titulo="Senha alterada">
    <AvisoDeSucesso
      titulo="Pronto"
      descricao="Sua senha foi trocada. Entre com ela para continuar."
    >
      <BotaoBase @click="router.push('/entrar')">Entrar</BotaoBase>
    </AvisoDeSucesso>
  </PaginaDeAutenticacao>

  <PaginaDeAutenticacao v-else titulo="Escolher nova senha">
    <form class="campos" novalidate @submit.prevent="enviar">
      <CampoTexto
        v-model="senha"
        rotulo="Nova senha"
        tipo="password"
        autocomplete="new-password"
        obrigatorio
        dica="Pelo menos 8 caracteres, e nada de senha comum."
        :erro="campos.nova_senha"
      />

      <CampoTexto
        v-model="confirmacao"
        rotulo="Repita a nova senha"
        tipo="password"
        autocomplete="new-password"
        obrigatorio
        :erro="conferenciaLocal"
      />

      <MensagemDeErro v-if="erro" :erro="erro" :detalhe="campos.token" sem-repetir />

      <BotaoBase tipo="submit" :carregando="enviando" largura-total>Salvar senha</BotaoBase>
    </form>

    <template #rodape>
      <p>
        Link expirado?
        <RouterLink to="/recuperar-senha">Peça outro</RouterLink>
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
</style>
