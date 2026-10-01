<script setup lang="ts">
/**
 * A anatomia comum dos campos de formulário: rótulo, controle, e dica ou
 * erro — já ligados por acessibilidade.
 *
 * Quem usa põe só o controle (entrada, seleção, área de texto), e recebe pelo
 * slot os atributos para amarrar nele: o `id` do rótulo, o `aria-describedby`
 * com erro e dica, o `aria-invalid` e a classe. Assim a ligação é escrita uma
 * vez, e um campo novo não esquece metade dela.
 *
 * O `id` sai do `useId` do Vue: o campo pode aparecer duas vezes na mesma tela
 * sem que os rótulos apontem para o mesmo elemento.
 */
import { computed, useId } from 'vue'

const props = defineProps<{
  rotulo: string
  dica?: string
  erro?: string
  obrigatorio?: boolean
}>()

defineSlots<{ default(atributos: AtributosDoControle): unknown }>()

interface AtributosDoControle {
  id: string
  class: (string | Record<string, boolean>)[]
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

const identificador = useId()
const idDaDica = `${identificador}-dica`
const idDoErro = `${identificador}-erro`

const controle = computed<AtributosDoControle>(() => {
  // O leitor de tela recebe erro e dica na ordem em que a pessoa precisa.
  const descricao = [props.erro ? idDoErro : null, props.dica ? idDaDica : null].filter(Boolean)
  return {
    id: identificador,
    class: ['campo__controle', { 'campo__controle--invalido': Boolean(props.erro) }],
    'aria-invalid': props.erro ? true : undefined,
    'aria-describedby': descricao.length ? descricao.join(' ') : undefined,
  }
})
</script>

<template>
  <div class="campo">
    <label class="campo__rotulo" :for="identificador">
      {{ rotulo }}
      <span v-if="obrigatorio" class="campo__obrigatorio" aria-hidden="true">*</span>
    </label>

    <slot v-bind="controle" />

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

/* O controle vem pelo slot, renderizado no componente de quem usa; o
   `:slotted` é o que deixa este estilo escopado alcançá-lo. */
:slotted(.campo__controle) {
  min-height: 2.75rem;
  padding: 0 var(--e3);
  background: var(--papel-alto);
  border: 1px solid var(--linha-forte);
  border-radius: var(--raio-controle);
  font-size: var(--texto-base);
  transition: border-color var(--transicao);
}

:slotted(textarea.campo__controle) {
  padding: var(--e2) var(--e3);
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

:slotted(.campo__controle::placeholder) {
  color: var(--tinta-fraca);
}

:slotted(.campo__controle:hover:not(:disabled)) {
  border-color: var(--tinta-media);
}

:slotted(.campo__controle:disabled) {
  background: var(--papel-fundo);
  cursor: not-allowed;
}

:slotted(.campo__controle--invalido) {
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
