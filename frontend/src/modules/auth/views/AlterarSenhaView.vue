<script setup lang="ts">
/**
 * Troca de senha da própria conta.
 *
 * O backend derruba todos os tokens da conta depois da troca — inclusive o
 * access que acabou de ser usado. Então a sessão cai aqui de propósito, e a
 * tela avisa isso antes em vez de deixar a pessoa levar um 401 na cara na
 * próxima página que abrir.
 *
 * Vive no módulo de autenticação porque é senha, mas aparece sob o cabeçalho
 * da conta: para quem usa, é uma das telas de 'minha conta'.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import NavegacaoDaConta from '@/modules/perfil/components/NavegacaoDaConta.vue'
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
  <!-- Depois da troca a sessão já caiu, então o cabeçalho da conta sai de
       cena junto: as outras telas dela não abririam mais. -->
  <PaginaDeAutenticacao v-if="trocada" titulo="Senha alterada">
    <AvisoDeSucesso
      titulo="Pronto"
      descricao="Por segurança, a troca de senha encerra as sessões abertas. Entre de novo com a senha nova."
    >
      <BotaoBase @click="router.push('/entrar')">Entrar</BotaoBase>
    </AvisoDeSucesso>
  </PaginaDeAutenticacao>

  <template v-else>
    <NavegacaoDaConta />

    <section class="senha">
      <h2 class="senha__titulo">Alterar senha</h2>
      <p class="senha__aviso">
        Ao trocar a senha, todas as sessões abertas são encerradas e você entra de novo.
      </p>

      <form class="campos" novalidate @submit.prevent="enviar">
        <CampoTexto
          v-model="atual"
          rotulo="Senha atual"
          tipo="password"
          autocomplete="current-password"
          obrigatorio
          :erro="campos.senha_atual"
          :desabilitado="enviando"
        />

        <CampoTexto
          v-model="nova"
          rotulo="Nova senha"
          tipo="password"
          autocomplete="new-password"
          obrigatorio
          dica="Pelo menos 8 caracteres, e nada de senha comum."
          :erro="campos.nova_senha"
          :desabilitado="enviando"
        />

        <CampoTexto
          v-model="confirmacao"
          rotulo="Repita a nova senha"
          tipo="password"
          autocomplete="new-password"
          obrigatorio
          :erro="conferenciaLocal"
          :desabilitado="enviando"
        />

        <MensagemDeErro v-if="erro" :erro="erro" sem-repetir />

        <div>
          <BotaoBase tipo="submit" :carregando="enviando">Salvar senha</BotaoBase>
        </div>
      </form>
    </section>
  </template>
</template>

<style scoped>
.senha {
  max-width: 26rem;
}

.senha__titulo {
  font-size: var(--texto-lg);
}

.senha__aviso {
  margin-top: var(--e2);
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.campos {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  margin-top: var(--e5);
}
</style>
