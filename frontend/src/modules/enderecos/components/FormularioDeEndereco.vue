<script setup lang="ts">
/**
 * Formulário de endereço, usado no checkout e no perfil.
 *
 * Não salva nada: recebe o estado do envio e devolve os dados. Quem persiste é
 * quem usa, porque criar e editar batem em endpoints diferentes.
 *
 * A busca de CEP preenche o que o provedor sabe e deixa o resto para a pessoa.
 * Falha na busca não trava o formulário: dá para digitar tudo à mão.
 */
import { ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import { deErro, type CamposComErro, type ErroDaApi } from '@/services/erros'
import { apenasDigitos } from '@/utils/formato'
import { consultarCep } from '../services/enderecos'
import { UFS, ehSiglaDaUF } from '../ufs'
import type { DadosDeEndereco, Endereco, SiglaDaUF } from '../types'

/**
 * O formulário em edição. Todo campo existe como texto, mesmo os que a API
 * trata como opcionais, e a UF pode ainda não ter sido escolhida.
 */
type Rascunho = Required<Omit<DadosDeEndereco, 'uf'>> & { uf: SiglaDaUF | '' }

const props = withDefaults(
  defineProps<{
    valorInicial?: Endereco | null
    enviando?: boolean
    campos?: CamposComErro
    textoDoBotao?: string
  }>(),
  { textoDoBotao: 'Salvar endereço' },
)

const emit = defineEmits<{ enviar: [dados: DadosDeEndereco] }>()

const dados = ref<Rascunho>({
  apelido: props.valorInicial?.apelido ?? '',
  cep: props.valorInicial?.cep ?? '',
  logradouro: props.valorInicial?.logradouro ?? '',
  numero: props.valorInicial?.numero ?? '',
  complemento: props.valorInicial?.complemento ?? '',
  bairro: props.valorInicial?.bairro ?? '',
  cidade: props.valorInicial?.cidade ?? '',
  uf: props.valorInicial?.uf ?? '',
})

const buscandoCep = ref(false)
const erroDoCep = ref<string | null>(null)

async function buscarCep(): Promise<void> {
  const digitos = apenasDigitos(dados.value.cep)
  erroDoCep.value = null

  if (digitos.length !== 8) {
    erroDoCep.value = 'O CEP tem oito dígitos.'
    return
  }

  buscandoCep.value = true
  try {
    const encontrado = await consultarCep(digitos)
    dados.value = {
      ...dados.value,
      cep: digitos,
      logradouro: encontrado.logradouro || dados.value.logradouro,
      bairro: encontrado.bairro || dados.value.bairro,
      cidade: encontrado.cidade || dados.value.cidade,
      // O provedor devolve texto. Sigla que o backend não conhece deixaria o
      // seletor em branco, então só entra a que ele aceita.
      uf: ehSiglaDaUF(encontrado.uf) ? encontrado.uf : dados.value.uf,
    }
  } catch (falha) {
    const problema: ErroDaApi = deErro(falha)
    erroDoCep.value = problema.campos.cep ?? problema.message
  } finally {
    buscandoCep.value = false
  }
}

function enviar(): void {
  emit('enviar', {
    ...dados.value,
    // O CEP vai só com os dígitos: o backend valida com `^\d{8}$`.
    cep: apenasDigitos(dados.value.cep),
    // UF não escolhida vai vazia mesmo. Quem recusa é o servidor, que devolve
    // o erro no campo, do mesmo jeito que faz com qualquer outro.
    uf: dados.value.uf as SiglaDaUF,
  })
}
</script>

<template>
  <form class="formulario" novalidate @submit.prevent="enviar">
    <div class="cep">
      <CampoTexto
        v-model="dados.cep"
        rotulo="CEP"
        inputmode="numeric"
        :maxlength="9"
        obrigatorio
        :erro="campos?.cep ?? erroDoCep ?? undefined"
        :desabilitado="enviando"
        dica="Buscamos o endereço para você."
      />
      <BotaoBase variante="secundario" :carregando="buscandoCep" @click="buscarCep">
        Buscar CEP
      </BotaoBase>
    </div>

    <CampoTexto
      v-model="dados.logradouro"
      rotulo="Rua"
      :maxlength="120"
      obrigatorio
      :erro="campos?.logradouro"
      :desabilitado="enviando"
    />

    <div class="dupla">
      <CampoTexto
        v-model="dados.numero"
        rotulo="Número"
        :maxlength="10"
        obrigatorio
        :erro="campos?.numero"
        :desabilitado="enviando"
      />
      <CampoTexto
        v-model="dados.complemento"
        rotulo="Complemento"
        :maxlength="60"
        :erro="campos?.complemento"
        :desabilitado="enviando"
        dica="Apartamento, bloco, referência."
      />
    </div>

    <CampoTexto
      v-model="dados.bairro"
      rotulo="Bairro"
      :maxlength="60"
      obrigatorio
      :erro="campos?.bairro"
      :desabilitado="enviando"
    />

    <div class="dupla">
      <CampoTexto
        v-model="dados.cidade"
        rotulo="Cidade"
        :maxlength="60"
        obrigatorio
        :erro="campos?.cidade"
        :desabilitado="enviando"
      />

      <div class="campo">
        <label class="campo__rotulo" for="uf">
          Estado
          <span class="campo__obrigatorio" aria-hidden="true">*</span>
        </label>
        <select
          id="uf"
          v-model="dados.uf"
          class="campo__select"
          :class="{ 'campo__select--invalido': Boolean(campos?.uf) }"
          :disabled="enviando"
          :aria-invalid="campos?.uf ? true : undefined"
          :aria-describedby="campos?.uf ? 'uf-erro' : undefined"
          required
        >
          <option value="" disabled>Escolha</option>
          <option v-for="unidade in UFS" :key="unidade.sigla" :value="unidade.sigla">
            {{ unidade.sigla }} — {{ unidade.nome }}
          </option>
        </select>
        <p v-if="campos?.uf" id="uf-erro" class="campo__erro">{{ campos.uf }}</p>
      </div>
    </div>

    <CampoTexto
      v-model="dados.apelido"
      rotulo="Apelido"
      :maxlength="30"
      :erro="campos?.apelido"
      :desabilitado="enviando"
      dica="Para reconhecer depois: casa, trabalho."
    />

    <div class="acoes">
      <BotaoBase tipo="submit" :carregando="enviando">{{ textoDoBotao }}</BotaoBase>
      <slot name="acoes" />
    </div>
  </form>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 34rem;
}

.cep {
  display: flex;
  align-items: flex-start;
  gap: var(--e2);
}

.cep :deep(.campo) {
  flex: 1;
  min-width: 0;
}

/* Alinha o botão com o campo, que tem o rótulo por cima. */
.cep :deep(.botao) {
  margin-top: 1.75rem;
}

.dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--e4);
}

.campo {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}

.campo__rotulo {
  font-size: var(--texto-sm);
  font-weight: 600;
}

.campo__obrigatorio {
  color: var(--alerta);
}

.campo__select {
  min-height: 2.75rem;
  padding: 0 var(--e2);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
}

.campo__select--invalido {
  border-color: var(--alerta);
}

.campo__erro {
  font-size: var(--texto-xs);
  color: var(--alerta);
}

.acoes {
  display: flex;
  gap: var(--e2);
  margin-top: var(--e2);
}

@media (max-width: 34rem) {
  .dupla {
    grid-template-columns: 1fr;
  }
}
</style>
