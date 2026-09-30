<script setup lang="ts">
/**
 * Falha na tela.
 *
 * Mostra o que o `ErroDaApi` já decidiu que a pessoa pode ler, e oferece
 * repetir só quando repetir tem chance de mudar o resultado.
 */
import BotaoBase from './BotaoBase.vue'
import type { ErroDaApi } from '@/services/erros'

const props = defineProps<{
  erro: ErroDaApi
  /**
   * Erro de um campo que não existe na tela.
   *
   * O DRF devolve o problema por campo, e alguns não têm entrada visível —
   * o `token` de um link de e-mail, por exemplo. Sem isto, a pessoa leria
   * 'confira os campos destacados' sem ter campo nenhum destacado.
   */
  detalhe?: string
  /** Some o botão quando não há o que repetir (um envio de formulário, p.ex.). */
  semRepetir?: boolean
  repetindo?: boolean
}>()

const emit = defineEmits<{ repetir: [] }>()

function repetir() {
  emit('repetir')
}

const podeRepetir = () => !props.semRepetir && props.erro.vaiAdiantarTentarDeNovo
</script>

<template>
  <div class="erro" role="alert">
    <p class="erro__mensagem">{{ detalhe ?? erro.message }}</p>
    <BotaoBase v-if="podeRepetir()" variante="secundario" :carregando="repetindo" @click="repetir">
      Tentar de novo
    </BotaoBase>
  </div>
</template>

<style scoped>
.erro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--e4);
  /* Acompanha a medida do texto corrido: um aviso de uma linha esticado por
     1200px fica difícil de ler e desequilibra a página. */
  max-width: 44rem;
  padding: var(--e4) var(--e5);
  background: var(--alerta-papel);
  border-left: 3px solid var(--alerta);
  border-radius: var(--raio-superficie);
}

.erro__mensagem {
  font-size: var(--texto-sm);
  color: var(--alerta);
  margin: 0;
}
</style>
