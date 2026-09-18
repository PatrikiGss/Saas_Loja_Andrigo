<script setup lang="ts">
/**
 * Troca de senha da própria conta.
 *
 * O backend derruba todos os tokens da conta depois da troca — inclusive o
 * access que acabou de ser usado. Então a sessão cai aqui de propósito, e a
 * tela avisa isso antes em vez de deixar a pessoa levar um 401 na cara na
 * próxima página que abrir.
 */
import { computed, ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import { useRouter } from 'vue-router'
import AvisoDeSucesso from '../components/AvisoDeSucesso.vue'
import PaginaDeAutenticacao from '../components/PaginaDeAutenticacao.vue'
import { alterarSenha } from '../services/auth'
import { useSessao } from '../stores/sessao'

const router = useRouter()
const sessao = useSessao()

const atual = ref('')
const nova = ref('')
const confirmacao = ref('')
const trocada = ref(false)

const conferenciaLocal = computed(() =>
  confirmacao.value && nova.value !== confirmacao.value
    ? 'As duas senhas precisam ser iguais.'
    : undefined,
)

const { enviando, erro, campos, submeter } = useFormulario(async () => {
  await alterarSenha(atual.value, nova.value)
  // A sessão já não vale no servidor; limpar aqui evita a interface seguir
  // mostrando alguém autenticado com um token que morreu.
  sessao.limpar()
  trocada.value = true
})

function enviar() {
  if (conferenciaLocal.value) {
    return
  }
  void submeter()
}
</script>

<template>
  <PaginaDeAutenticacao v-if="trocada" titulo="Senha alterada">
    <AvisoDeSucesso
      titulo="Pronto"
      descricao="Por segurança, a troca de senha encerra as sessões abertas. Entre de novo com a senha nova."
    >
      <BotaoBase @click="router.push('/entrar')">Entrar</BotaoBase>
    </AvisoDeSucesso>
  </PaginaDeAutenticacao>

  <PaginaDeAutenticacao
    v-else
    titulo="Alterar senha"
    descricao="Ao trocar a senha, todas as sessões abertas são encerradas e você entra de novo."
  >
    <form class="campos" novalidate @submit.prevent="enviar">
      <CampoTexto
        v-model="atual"
        rotulo="Senha atual"
        tipo="password"
        autocomplete="current-password"
        obrigatorio
        :erro="campos.senha_atual"
      />

      <CampoTexto
        v-model="nova"
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

      <MensagemDeErro v-if="erro" :erro="erro" sem-repetir />

      <BotaoBase tipo="submit" :carregando="enviando" largura-total>Salvar senha</BotaoBase>
    </form>
  </PaginaDeAutenticacao>
</template>

<style scoped>
.campos {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
</style>
