/**
 * Auditoria de acessibilidade das telas e dos componentes de formulário.
 *
 * Cobre o que a pessoa encontra pela frente: catálogo, produto, carrinho,
 * login, cadastro, conta, endereços e a gestão. Cada um é montado com dados
 * de verdade e passado pelo axe.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, type Component } from 'vue'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoSelecao from '@/components/CampoSelecao.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
import PerguntaDeIdade from '@/modules/idade/components/PerguntaDeIdade.vue'
import { useIdade } from '@/modules/idade/stores/idade'
import PaginacaoLista from '@/components/PaginacaoLista.vue'
import { useSessao } from '@/modules/auth/stores/sessao'
import LoginView from '@/modules/auth/views/LoginView.vue'
import CadastroView from '@/modules/auth/views/CadastroView.vue'
import CarrinhoView from '@/modules/carrinho/views/CarrinhoView.vue'
import * as servicoCarrinho from '@/modules/carrinho/services/carrinho'
import * as servicoCatalogo from '@/modules/loja/services/catalogo'
import CatalogoView from '@/modules/loja/views/CatalogoView.vue'
import ProdutoView from '@/modules/loja/views/ProdutoView.vue'
import * as servicoEnderecos from '@/modules/enderecos/services/enderecos'
import EnderecosView from '@/modules/perfil/views/EnderecosView.vue'
import PerfilView from '@/modules/perfil/views/PerfilView.vue'
import * as servicoPerfil from '@/modules/perfil/services/perfil'
import ProdutosView from '@/modules/admin/views/ProdutosView.vue'
import UsuariosView from '@/modules/admin/views/UsuariosView.vue'
import * as servicoProdutos from '@/modules/admin/services/produtos'
import * as servicoUsuarios from '@/modules/admin/services/usuarios'
import { auditar, descrever } from './acessibilidade'
import {
  paginaCom,
  umaEssencia,
  umCarrinho,
  umEndereco,
  umPerfil,
  umProdutoDeGestao,
  umSubtipo,
  umUsuarioAdmin,
} from './fixtures'
import { montarNaRota } from './roteador'

vi.mock('@/modules/loja/services/catalogo')
vi.mock('@/modules/carrinho/services/carrinho')
vi.mock('@/modules/enderecos/services/enderecos')
vi.mock('@/modules/perfil/services/perfil')
vi.mock('@/modules/admin/services/produtos')
vi.mock('@/modules/admin/services/usuarios')
vi.mock('@/modules/auth/services/auth')

const ROTAS = {
  inicio: '/',
  catalogo: '/catalogo',
  produto: '/produto/:id',
  carrinho: '/carrinho',
  checkout: '/checkout',
  entrar: '/entrar',
  'criar-conta': '/criar-conta',
  'recuperar-senha': '/recuperar-senha',
  conta: '/conta',
  'conta-enderecos': '/conta/enderecos',
  'alterar-senha': '/conta/senha',
  'admin-produtos': '/admin/produtos',
  'admin-produto-novo': '/admin/produtos/novo',
  'admin-produto': '/admin/produtos/:id',
}

/** Monta preso ao documento: regras de foco e rótulo exigem árvore real. */
async function montarEAuditar(tela: Component, caminho = '/') {
  const { tela: montado } = await montarNaRota(tela, caminho, ROTAS, { attachTo: document.body })

  const violacoes = await auditar(montado)
  montado.unmount()
  return violacoes
}

const PRODUTO = umaEssencia()

const SUBTIPOS = [umSubtipo('essencia-nic-salt', 'essencia', 'Nic salt')]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servicoCatalogo.listarSubtipos).mockResolvedValue(SUBTIPOS)
  vi.mocked(servicoCatalogo.listarProdutos).mockResolvedValue(paginaCom([PRODUTO]))
  vi.mocked(servicoCatalogo.buscarProduto).mockResolvedValue(PRODUTO)
  vi.mocked(servicoCarrinho.buscarCarrinho).mockResolvedValue(umCarrinho())
  vi.mocked(servicoEnderecos.listarEnderecos).mockResolvedValue([umEndereco()])
  vi.mocked(servicoPerfil.buscarPerfil).mockResolvedValue(umPerfil())
  vi.mocked(servicoProdutos.listarProdutos).mockResolvedValue(
    paginaCom([umProdutoDeGestao(PRODUTO)]),
  )
  vi.mocked(servicoUsuarios.listarUsuarios).mockResolvedValue([umUsuarioAdmin({ nivel: 'admin' })])
})

function conferir(violacoes: Awaited<ReturnType<typeof auditar>>) {
  expect(violacoes, descrever(violacoes)).toEqual([])
}

describe('acessibilidade das telas', () => {
  it('catálogo', async () => {
    conferir(await montarEAuditar(CatalogoView, '/catalogo'))
  })

  it('página do produto', async () => {
    conferir(await montarEAuditar(ProdutoView, '/produto/uuid-1'))
  })

  it('carrinho', async () => {
    const tela = await montarEAuditar(CarrinhoView, '/carrinho')
    conferir(tela)
  })

  it('entrar', async () => {
    conferir(await montarEAuditar(LoginView, '/entrar'))
  })

  it('criar conta', async () => {
    conferir(await montarEAuditar(CadastroView, '/criar-conta'))
  })

  it('dados pessoais', async () => {
    conferir(await montarEAuditar(PerfilView, '/conta'))
  })

  it('endereços', async () => {
    conferir(await montarEAuditar(EnderecosView, '/conta/enderecos'))
  })

  it('gestão de produtos', async () => {
    conferir(await montarEAuditar(ProdutosView, '/admin/produtos'))
  })

  it('gestão de contas', async () => {
    const sessao = useSessao()
    sessao.usuario = umPerfil({ nivel: 'admin' })

    conferir(await montarEAuditar(UsuariosView, '/admin/usuarios'))
  })
})

describe('acessibilidade dos componentes de base', () => {
  it('campo de texto com erro anunciado', async () => {
    const montado = mount(CampoTexto, {
      props: {
        rotulo: 'E-mail',
        modelValue: '',
        erro: 'E-mail já cadastrado.',
        obrigatorio: true,
      },
      attachTo: document.body,
    })

    conferir(await auditar(montado))
    montado.unmount()
  })

  it('campo de seleção com erro anunciado', async () => {
    const montado = mount(CampoSelecao, {
      props: {
        rotulo: 'Estado',
        modelValue: '',
        erro: 'Faça uma escolha válida.',
        obrigatorio: true,
      },
      slots: { default: () => [h('option', { value: 'SP' }, 'São Paulo')] },
      attachTo: document.body,
    })

    conferir(await auditar(montado))
    montado.unmount()
  })

  it('botão em carregamento', async () => {
    const montado = mount(BotaoBase, {
      props: { carregando: true },
      slots: { default: 'Entrar' },
      attachTo: document.body,
    })

    conferir(await auditar(montado))
    montado.unmount()
  })

  it('diálogo de confirmação aberto', async () => {
    const montado = mount(DialogoDeConfirmacao, {
      props: {
        aberto: true,
        titulo: 'Limpar o carrinho?',
        descricao: 'Não dá para desfazer.',
        confirmar: 'Limpar carrinho',
      },
      attachTo: document.body,
    })
    await flushPromises()

    conferir(await auditar(montado))
    montado.unmount()
  })

  it('pergunta de idade aberta', async () => {
    void useIdade().confirmar('entrada')
    const montado = mount(PerguntaDeIdade, { attachTo: document.body })
    await flushPromises()

    conferir(await auditar(montado))
    montado.unmount()
  })

  it('paginação', async () => {
    const montado = mount(PaginacaoLista, {
      props: { pagina: 2, total: 60, porPagina: 20 },
      attachTo: document.body,
    })

    conferir(await auditar(montado))
    montado.unmount()
  })
})
