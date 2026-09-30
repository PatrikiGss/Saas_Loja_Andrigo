<script setup lang="ts">
/**
 * Dados pessoais da conta.
 *
 * E-mail e nível aparecem, mas não têm campo: o e-mail é o identificador do
 * login e o nível vive em `is_staff` no backend, sem coluna própria que um
 * payload pudesse alcançar. Mostrar em texto é honesto; oferecer um campo
 * que o servidor ignoraria não seria.
 */
import { ref, watch } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import { useFormulario } from '@/composables/useFormulario'
import { useRequisicao } from '@/composables/useRequisicao'
import { useSessao } from '@/modules/auth/stores/sessao'
import NavegacaoDaConta from '../components/NavegacaoDaConta.vue'
import { atualizarPerfil, buscarPerfil, type DadosDoPerfil } from '../services/perfil'

const sessao = useSessao()

const { dados: perfil, carregando, erro, executar } = useRequisicao(buscarPerfil)

const formulario = ref<DadosDoPerfil>({ nome: '', sobrenome: '', telefone: '' })
const salvo = ref(false)

watch(perfil, (atual) => {
  if (atual) {
    formulario.value = {
      nome: atual.nome,
      sobrenome: atual.sobrenome,
      telefone: atual.telefone,
    }
  }
})

const {
  enviando,
  erro: erroAoSalvar,
  campos,
  submeter,
} = useFormulario(async () => {
  const atualizado = await atualizarPerfil(formulario.value)
  perfil.value = atualizado
  // O cabeçalho mostra o nome; sem isto ele seguiria com o valor antigo.
  sessao.guardarPerfil(atualizado)
  salvo.value = true
})

function salvar(): void {
  salvo.value = false
  void submeter()
}
</script>

<template>
  <NavegacaoDaConta />

  <CarregandoIndicador v-if="carregando" texto="Carregando seus dados" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <div v-else-if="perfil" class="conteudo">
    <dl class="fixos">
      <div class="fixos__linha">
        <dt>E-mail</dt>
        <dd>{{ perfil.email }}</dd>
      </div>
      <div class="fixos__linha">
        <dt>Nível de acesso</dt>
        <dd>{{ perfil.nivel === 'admin' ? 'Administrador' : 'Cliente' }}</dd>
      </div>
    </dl>
    <p class="fixos__nota">E-mail e nível de acesso não são editáveis por aqui.</p>

    <form class="campos" novalidate @submit.prevent="salvar">
      <CampoTexto
        v-model="formulario.nome"
        rotulo="Nome"
        autocomplete="given-name"
        :maxlength="150"
        :erro="campos.nome"
        :desabilitado="enviando"
      />

      <CampoTexto
        v-model="formulario.sobrenome"
        rotulo="Sobrenome"
        autocomplete="family-name"
        :maxlength="150"
        :erro="campos.sobrenome"
        :desabilitado="enviando"
      />

      <CampoTexto
        v-model="formulario.telefone"
        rotulo="Telefone"
        tipo="tel"
        autocomplete="tel"
        :maxlength="20"
        dica="Com DDD. Pode usar espaços, parênteses e hífen."
        :erro="campos.telefone"
        :desabilitado="enviando"
      />

      <MensagemDeErro v-if="erroAoSalvar" :erro="erroAoSalvar" sem-repetir />

      <p v-if="salvo" class="salvo" role="status">Dados atualizados.</p>

      <div>
        <BotaoBase tipo="submit" :carregando="enviando">Salvar alterações</BotaoBase>
      </div>
    </form>
  </div>
</template>

<style scoped>
.conteudo {
  max-width: 34rem;
}

.fixos {
  margin: 0;
  border-top: 1px solid var(--linha);
}

.fixos__linha {
  display: flex;
  justify-content: space-between;
  gap: var(--e4);
  padding: var(--e3) 0;
  border-bottom: 1px solid var(--linha);
  font-size: var(--texto-sm);
}

.fixos__linha dd {
  margin: 0;
  font-weight: 600;
}

.fixos__nota {
  margin-top: var(--e2);
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.campos {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  margin-top: var(--e6);
}

.salvo {
  padding-left: var(--e3);
  border-left: 3px solid var(--tinta);
  font-size: var(--texto-sm);
  font-weight: 600;
}
</style>
