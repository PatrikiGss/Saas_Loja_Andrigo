<script setup lang="ts">
/**
 * Campo de texto com rótulo, dica e erro já ligados por acessibilidade.
 *
 * O `id` sai do `useId` do Vue: o campo pode aparecer duas vezes na mesma tela
 * sem que os rótulos apontem para o mesmo elemento.
 */
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    rotulo: string
    tipo?: 'text' | 'email' | 'password' | 'tel' | 'number'
    dica?: string
    erro?: string
    obrigatorio?: boolean
    desabilitado?: boolean
    autocomplete?: string
    placeholder?: string
    inputmode?: 'text' | 'numeric' | 'tel' | 'email'
    maxlength?: number
  }>(),
  {
    tipo: 'text',
    obrigatorio: false,
    desabilitado: false,
  },
)

const valor = defineModel<string>({ required: true })

const identificador = useId()
const idDaDica = computed(() => `${identificador}-dica`)
const idDoErro = computed(() => `${identificador}-erro`)

/** O leitor de tela recebe erro e dica na ordem em que a pessoa precisa. */
const descritoPor = computed(() => {
  const partes: string[] = []
  if (props.erro) partes.push(idDoErro.value)
  if (props.dica) partes.push(idDaDica.value)
  return partes.length ? partes.join(' ') : undefined
})
</script>

<template>
  <div class="campo">
    <label class="campo__rotulo" :for="identificador">
      {{ rotulo }}
      <span v-if="obrigatorio" class="campo__obrigatorio" aria-hidden="true">*</span>
    </label>

    <input
      :id="identificador"
      v-model="valor"
      class="campo__entrada"
      :class="{ 'campo__entrada--invalida': Boolean(erro) }"
      :type="tipo"
      :required="obrigatorio"
      :disabled="desabilitado"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :aria-invalid="erro ? true : undefined"
      :aria-describedby="descritoPor"
    />

    <p v-if="erro" :id="idDoErro" class="campo__erro">{{ erro }}</p>
    <p v-else-if="dica" :id="idDaDica" class="campo__dica">{{ dica }}</p>
  </div>
</template>

<style scoped>
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

.campo__entrada {
  min-height: 2.75rem;
  padding: 0 var(--e3);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
  transition: border-color var(--transicao);
}

.campo__entrada::placeholder {
  color: var(--tinta-fraca);
}

.campo__entrada:hover:not(:disabled) {
  border-color: var(--tinta-media);
}

.campo__entrada:disabled {
  background: var(--papel-fundo);
  cursor: not-allowed;
}

.campo__entrada--invalida {
  border-color: var(--alerta);
}

.campo__erro,
.campo__dica {
  font-size: var(--texto-xs);
  line-height: 1.4;
}

.campo__erro {
  color: var(--alerta);
}

.campo__dica {
  color: var(--tinta-media);
}
</style>
