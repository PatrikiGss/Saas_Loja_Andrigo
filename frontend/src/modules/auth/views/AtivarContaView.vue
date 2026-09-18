<script setup lang="ts">
/**
 * Confirmação do e-mail pelo link do cadastro.
 *
 * O endereço é o que o backend monta em `painel/emails.py`:
 * `{FRONTEND_URL}/ativar/<uid>/<token>/`. A confirmação dispara sozinha ao
 * abrir a página: a pessoa já decidiu quando clicou no link do e-mail.
 */
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import AvisoDeSucesso from '../components/AvisoDeSucesso.vue'
import PaginaDeAutenticacao from '../components/PaginaDeAutenticacao.vue'
import { ativarConta } from '../services/auth'

const rota = useRoute()
const router = useRouter()
const ativada = ref(false)

const { enviando, erro, campos, submeter } = useFormulario(() =>
  ativarConta({ uid: String(rota.params.uid), token: String(rota.params.token) }),
)

onMounted(async () => {
  await submeter()
  ativada.value = erro.value === null
})
</script>

<template>
  <PaginaDeAutenticacao titulo="Ativação da conta">
    <CarregandoIndicador v-if="enviando" texto="Confirmando o e-mail" />

    <AvisoDeSucesso
      v-else-if="ativada"
      titulo="Conta confirmada"
      descricao="Seu e-mail está confirmado e a conta já funciona."
    >
      <BotaoBase @click="router.push('/entrar')">Entrar na conta</BotaoBase>
    </AvisoDeSucesso>

    <div v-else-if="erro" class="falha">
      <MensagemDeErro :erro="erro" :detalhe="campos.token" sem-repetir />
      <p class="falha__saida">
        Links de ativação valem uma vez só e expiram. Se o seu já foi usado,
        <RouterLink to="/entrar">entre normalmente</RouterLink>; se expirou,
        <RouterLink to="/criar-conta">refaça o cadastro</RouterLink>.
      </p>
    </div>
  </PaginaDeAutenticacao>
</template>

<style scoped>
.falha {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}

.falha__saida {
  font-size: var(--texto-sm);
  color: var(--tinta-media);
}

.falha__saida :deep(a) {
  color: var(--tinta);
  font-weight: 600;
}
</style>
