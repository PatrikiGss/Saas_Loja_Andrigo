<script setup lang="ts">
/**
 * Contas da loja.
 *
 * Não há exclusão: desativar basta e dá para voltar atrás. O backend recusa
 * mexer na própria conta e em superusuário, e essas duas recusas vêm com
 * texto próprio — é um dos poucos lugares em que vale mostrar o `detail` que
 * o servidor mandou em vez da mensagem genérica de permissão.
 */
import { ref } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CarregandoIndicador from '@/components/CarregandoIndicador.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import MensagemDeErro from '@/components/MensagemDeErro.vue'
import TabelaDados, { type Coluna } from '@/components/TabelaDados.vue'
import { useRequisicao } from '@/composables/useRequisicao'
import { useSessao } from '@/modules/auth/stores/sessao'
import { deErro, type ErroDaApi } from '@/services/erros'
import { dataHora } from '@/utils/formato'
import { definirAtivo, definirNivel, listarUsuarios } from '../services/usuarios'
import type { UsuarioAdmin } from '../types'

const COLUNAS: Coluna[] = [
  { chave: 'conta', titulo: 'Conta' },
  { chave: 'nivel', titulo: 'Nível' },
  { chave: 'situacao', titulo: 'Situação' },
  { chave: 'cadastro', titulo: 'Cadastro' },
  { chave: 'acoes' },
]

const sessao = useSessao()
const { dados: usuarios, carregando, erro, executar } = useRequisicao(listarUsuarios)

/** Id da conta cuja alteração está em andamento, para travar só a linha dela. */
const emMudanca = ref<number | null>(null)
const erroDaAcao = ref<ErroDaApi | null>(null)
const promovendo = ref<UsuarioAdmin | null>(null)

/**
 * Roda uma alteração e relê a lista.
 *
 * Uma de cada vez: mexer em duas contas ao mesmo tempo embaralharia qual
 * recusa pertence a qual linha.
 */
async function rodar(id: number, acao: () => Promise<unknown>): Promise<void> {
  if (emMudanca.value !== null) {
    return
  }

  emMudanca.value = id
  erroDaAcao.value = null
  try {
    await acao()
    await executar()
  } catch (falha) {
    erroDaAcao.value = deErro(falha)
  } finally {
    emMudanca.value = null
  }
}

function alternarAtivo(usuario: UsuarioAdmin): void {
  void rodar(usuario.id, () => definirAtivo(usuario.id, !usuario.ativo))
}

async function confirmarNivel(): Promise<void> {
  const usuario = promovendo.value
  if (!usuario) return
  const novo = usuario.nivel === 'admin' ? 'usuario' : 'admin'
  promovendo.value = null
  await rodar(usuario.id, () => definirNivel(usuario.id, novo))
}
</script>

<template>
  <h1 class="titulo">Usuários</h1>

  <CarregandoIndicador v-if="carregando" texto="Carregando as contas" />

  <MensagemDeErro v-else-if="erro" :erro="erro" @repetir="executar" />

  <template v-else>
    <!-- Aqui o `detail` do servidor vale mais que a mensagem genérica: ele
         diz qual das duas contas protegidas foi tocada. -->
    <MensagemDeErro
      v-if="erroDaAcao"
      :erro="erroDaAcao"
      :detalhe="erroDaAcao.detalheDoServidor ?? undefined"
      sem-repetir
      class="recusa"
    />

    <TabelaDados
      :colunas="COLUNAS"
      :itens="usuarios ?? []"
      :chave-de="(usuario) => usuario.id"
      descricao="Contas cadastradas"
    >
      <template #conta="{ item }">
        <span class="conta__email">{{ item.email }}</span>
        <span v-if="item.nome || item.sobrenome" class="conta__nome">
          {{ item.nome }} {{ item.sobrenome }}
        </span>
        <span v-if="item.email === sessao.usuario?.email" class="conta__voce">
          esta é a sua conta
        </span>
      </template>

      <template #nivel="{ item }">
        {{ item.nivel === 'admin' ? 'Admin' : 'Cliente' }}
      </template>

      <template #situacao="{ item }">
        <span :class="{ inativo: !item.ativo }">
          {{ item.ativo ? 'Ativa' : 'Desativada' }}
        </span>
      </template>

      <template #cadastro="{ item }">
        <span class="numerico">{{ dataHora(item.criado_em) }}</span>
      </template>

      <template #acoes="{ item }">
        <div class="acoes">
          <BotaoBase
            variante="secundario"
            :desabilitado="emMudanca === item.id"
            @click="alternarAtivo(item)"
          >
            {{ item.ativo ? 'Desativar' : 'Reativar' }}
          </BotaoBase>
          <BotaoBase
            variante="discreto"
            :desabilitado="emMudanca === item.id"
            @click="promovendo = item"
          >
            {{ item.nivel === 'admin' ? 'Rebaixar' : 'Tornar admin' }}
          </BotaoBase>
        </div>
      </template>
    </TabelaDados>
  </template>

  <DialogoDeConfirmacao
    :aberto="promovendo !== null"
    :titulo="promovendo?.nivel === 'admin' ? 'Rebaixar esta conta?' : 'Tornar esta conta admin?'"
    :descricao="
      promovendo?.nivel === 'admin'
        ? 'Ela perde acesso à gestão de produtos, pedidos e contas.'
        : 'Ela passa a ver e alterar produtos, pedidos e contas de todo mundo.'
    "
    :confirmar="promovendo?.nivel === 'admin' ? 'Rebaixar' : 'Tornar admin'"
    @confirmar="confirmarNivel"
    @cancelar="promovendo = null"
  />
</template>

<style scoped>
.titulo {
  font-size: var(--texto-xl);
  font-stretch: 85%;
  margin-bottom: var(--e5);
}

.recusa {
  margin-bottom: var(--e4);
}

.conta__email {
  display: block;
  font-weight: 600;
}

.conta__nome,
.conta__voce {
  display: block;
  font-size: var(--texto-xs);
  color: var(--tinta-media);
}

.conta__voce {
  font-weight: 600;
}

.inativo {
  color: var(--tinta-media);
}

.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}

.acoes :deep(.botao) {
  min-height: 2.25rem;
  padding: 0 var(--e3);
  font-size: var(--texto-xs);
}
</style>
