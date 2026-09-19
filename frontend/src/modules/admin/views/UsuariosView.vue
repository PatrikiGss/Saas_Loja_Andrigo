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
import { useRequisicao } from '@/composables/useRequisicao'
import { useSessao } from '@/modules/auth/stores/sessao'
import { deErro, type ErroDaApi } from '@/services/erros'
import { dataHora } from '@/utils/formato'
import { definirAtivo, definirNivel, listarUsuarios } from '../services/usuarios'
import type { UsuarioAdmin } from '../types'

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

    <table class="tabela">
      <caption class="apenas-leitor">Contas cadastradas</caption>
      <thead>
        <tr>
          <th scope="col">Conta</th>
          <th scope="col">Nível</th>
          <th scope="col">Situação</th>
          <th scope="col">Cadastro</th>
          <th scope="col"><span class="apenas-leitor">Ações</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="usuario in usuarios ?? []" :key="usuario.id">
          <td>
            <span class="conta__email">{{ usuario.email }}</span>
            <span v-if="usuario.nome || usuario.sobrenome" class="conta__nome">
              {{ usuario.nome }} {{ usuario.sobrenome }}
            </span>
            <span v-if="usuario.email === sessao.usuario?.email" class="conta__voce">
              esta é a sua conta
            </span>
          </td>

          <td>{{ usuario.nivel === 'admin' ? 'Admin' : 'Cliente' }}</td>

          <td>
            <span :class="{ 'inativo': !usuario.ativo }">
              {{ usuario.ativo ? 'Ativa' : 'Desativada' }}
            </span>
          </td>

          <td class="numerico">{{ dataHora(usuario.criado_em) }}</td>

          <td class="acoes">
            <BotaoBase
              variante="secundario"
              :desabilitado="emMudanca === usuario.id"
              @click="alternarAtivo(usuario)"
            >
              {{ usuario.ativo ? 'Desativar' : 'Reativar' }}
            </BotaoBase>
            <BotaoBase
              variante="discreto"
              :desabilitado="emMudanca === usuario.id"
              @click="promovendo = usuario"
            >
              {{ usuario.nivel === 'admin' ? 'Rebaixar' : 'Tornar admin' }}
            </BotaoBase>
          </td>
        </tr>
      </tbody>
    </table>
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

.tabela {
  width: 100%;
  border-collapse: collapse;
}

.tabela th {
  text-align: left;
  padding: var(--e2) var(--e3) var(--e2) 0;
  border-bottom: 1px solid var(--linha-forte);
  font-size: var(--texto-xs);
  font-weight: 700;
  color: var(--tinta-media);
}

.tabela td {
  padding: var(--e3) var(--e3) var(--e3) 0;
  border-bottom: 1px solid var(--linha);
  font-size: var(--texto-sm);
  vertical-align: top;
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

@media (max-width: 52rem) {
  .tabela,
  .tabela tbody,
  .tabela tr,
  .tabela td {
    display: block;
    width: 100%;
  }

  .tabela thead {
    display: none;
  }

  .tabela tr {
    padding: var(--e4) 0;
    border-bottom: 1px solid var(--linha);
  }

  .tabela td {
    padding: var(--e1) 0;
    border: 0;
  }
}
</style>
