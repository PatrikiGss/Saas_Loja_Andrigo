import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSessao } from '@/modules/auth/stores/sessao'
import type { Perfil } from '@/modules/auth/types'
import PerfilView from './PerfilView.vue'
import * as servico from '../services/perfil'

vi.mock('../services/perfil')

const PERFIL: Perfil = {
  email: 'ana@example.com',
  nome: 'Ana',
  sobrenome: 'Lima',
  telefone: '11 99999-0000',
  nivel: 'usuario',
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/conta', name: 'conta', component: Vazio },
      { path: '/conta/enderecos', name: 'conta-enderecos', component: Vazio },
      { path: '/conta/senha', name: 'alterar-senha', component: Vazio },
    ],
  })
}

async function montar() {
  const router = criarRouter()
  await router.push('/conta')
  await router.isReady()

  const tela = mount(PerfilView, { global: { plugins: [router] } })
  await flushPromises()
  return tela
}

function campoDe(tela: Awaited<ReturnType<typeof montar>>, rotulo: string) {
  return tela.findAll('.campo').find((bloco) => bloco.text().startsWith(rotulo))!
}

function valorDe(tela: Awaited<ReturnType<typeof montar>>, rotulo: string): string {
  return (campoDe(tela, rotulo).get('input').element as HTMLInputElement).value
}

function erro400(campos: Record<string, string[]>): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const resposta = {
    status: 400,
    data: campos,
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse
  return new AxiosError('falhou', '400', config, {}, resposta)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.buscarPerfil).mockReset().mockResolvedValue(PERFIL)
  vi.mocked(servico.atualizarPerfil).mockReset().mockResolvedValue(PERFIL)
})

describe('PerfilView', () => {
  it('começa com o que o servidor devolveu', async () => {
    const tela = await montar()

    expect(valorDe(tela, 'Nome')).toBe('Ana')
    expect(valorDe(tela, 'Sobrenome')).toBe('Lima')
    expect(valorDe(tela, 'Telefone')).toBe('11 99999-0000')
  })

  it('mostra e-mail e nível, mas não oferece campo para eles', async () => {
    // Não existe coluna `nivel` no banco, e o e-mail identifica o login: um
    // campo aqui prometeria uma edição que o servidor ignoraria.
    const tela = await montar()

    expect(tela.text()).toContain('ana@example.com')
    expect(tela.text()).toContain('Cliente')
    expect(campoDe(tela, 'E-mail')).toBeUndefined()
    expect(campoDe(tela, 'Nível')).toBeUndefined()
  })

  it('traduz o nível em vez de mostrar o identificador', async () => {
    vi.mocked(servico.buscarPerfil).mockResolvedValue({ ...PERFIL, nivel: 'admin' })

    const tela = await montar()

    expect(tela.text()).toContain('Administrador')
    expect(tela.text()).not.toContain('admin')
  })

  it('manda só os campos editáveis', async () => {
    const tela = await montar()

    await campoDe(tela, 'Nome').get('input').setValue('Ana Paula')
    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servico.atualizarPerfil).toHaveBeenCalledWith({
      nome: 'Ana Paula',
      sobrenome: 'Lima',
      telefone: '11 99999-0000',
    })
  })

  it('atualiza o nome do cabeçalho depois de salvar', async () => {
    const atualizado = { ...PERFIL, nome: 'Ana Paula' }
    vi.mocked(servico.atualizarPerfil).mockResolvedValue(atualizado)
    const sessao = useSessao()
    const tela = await montar()

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(sessao.nomeExibido).toBe('Ana Paula Lima')
    expect(tela.text()).toContain('Dados atualizados')
  })

  it('mostra a recusa do backend no campo certo', async () => {
    vi.mocked(servico.atualizarPerfil).mockRejectedValue(
      erro400({ telefone: ['Informe um telefone válido, com 8 a 20 caracteres.'] }),
    )
    const tela = await montar()

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).toContain('Informe um telefone válido')
    expect(tela.text()).not.toContain('Dados atualizados')
  })
})
