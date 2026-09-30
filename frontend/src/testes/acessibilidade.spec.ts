/**
 * Auditoria de acessibilidade das telas e dos componentes de formulário.
 *
 * Cobre o que a pessoa encontra pela frente: catálogo, produto, carrinho,
 * login, cadastro, conta, endereços e a gestão. Cada um é montado com dados
 * de verdade e passado pelo axe.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import BotaoBase from '@/components/BotaoBase.vue'
import CampoTexto from '@/components/CampoTexto.vue'
import DialogoDeConfirmacao from '@/components/DialogoDeConfirmacao.vue'
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
import type { Endereco } from '@/modules/enderecos/types'
import EnderecosView from '@/modules/perfil/views/EnderecosView.vue'
import PerfilView from '@/modules/perfil/views/PerfilView.vue'
import * as servicoPerfil from '@/modules/perfil/services/perfil'
import ProdutosView from '@/modules/admin/views/ProdutosView.vue'
import UsuariosView from '@/modules/admin/views/UsuariosView.vue'
import * as servicoProdutos from '@/modules/admin/services/produtos'
import * as servicoUsuarios from '@/modules/admin/services/usuarios'
import { auditar, descrever } from './acessibilidade'

vi.mock('@/modules/loja/services/catalogo')
vi.mock('@/modules/carrinho/services/carrinho')
vi.mock('@/modules/enderecos/services/enderecos')
vi.mock('@/modules/perfil/services/perfil')
vi.mock('@/modules/admin/services/produtos')
vi.mock('@/modules/admin/services/usuarios')
vi.mock('@/modules/auth/services/auth')

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'inicio', component: Vazio },
      { path: '/catalogo', name: 'catalogo', component: Vazio },
      { path: '/produto/:id', name: 'produto', component: Vazio },
      { path: '/carrinho', name: 'carrinho', component: Vazio },
      { path: '/checkout', name: 'checkout', component: Vazio },
      { path: '/entrar', name: 'entrar', component: Vazio },
      { path: '/criar-conta', name: 'criar-conta', component: Vazio },
      { path: '/recuperar-senha', name: 'recuperar-senha', component: Vazio },
      { path: '/conta', name: 'conta', component: Vazio },
      { path: '/conta/enderecos', name: 'conta-enderecos', component: Vazio },
      { path: '/conta/senha', name: 'alterar-senha', component: Vazio },
      { path: '/admin/produtos', name: 'admin-produtos', component: Vazio },
      { path: '/admin/produtos/novo', name: 'admin-produto-novo', component: Vazio },
      { path: '/admin/produtos/:id', name: 'admin-produto', component: Vazio },
    ],
  })
}

/** Monta preso ao documento: regras de foco e rótulo exigem árvore real. */
async function montarEAuditar(tela: Component, caminho = '/') {
  const router = criarRouter()
  await router.push(caminho)
  await router.isReady()

  const montado = mount(tela, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()

  const violacoes = await auditar(montado)
  montado.unmount()
  return violacoes
}

const PRODUTO = {
  id: 'uuid-1',
  sku: 'ESS-0001',
  nome: 'Nic salt menta',
  descricao: 'Essência de menta.',
  marca: 'Elfbar',
  categoria: 'essencia' as const,
  subtipo: 'essencia-nic-salt',
  preco: '49.90',
  em_estoque: true,
  puffs: null,
  volume_ml: '30.00',
  nicotina_mg_ml: '35.0',
}

const SUBTIPOS = [
  {
    slug: 'essencia-nic-salt',
    nome: 'Nic salt',
    categoria: 'essencia' as const,
    categoria_display: 'Essência',
  },
]

const ENDERECO: Endereco = {
  id: 1,
  apelido: 'Casa',
  cep: '01001000',
  logradouro: 'Praça da Sé',
  numero: '100',
  complemento: '',
  bairro: 'Sé',
  cidade: 'São Paulo',
  uf: 'SP',
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
  }
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servicoCatalogo.listarSubtipos).mockResolvedValue(SUBTIPOS)
  vi.mocked(servicoCatalogo.listarProdutos).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [PRODUTO],
  })
  vi.mocked(servicoCatalogo.buscarProduto).mockResolvedValue(PRODUTO)
  vi.mocked(servicoCarrinho.buscarCarrinho).mockResolvedValue({
    itens: [
      {
        id: 1,
        produto: { id: 'p1', sku: 'S1', nome: 'Pod de menta', preco: '49.90', disponivel: true },
        quantidade: 2,
        subtotal: '99.80',
      },
    ],
    total: '99.80',
  })
  vi.mocked(servicoEnderecos.listarEnderecos).mockResolvedValue([ENDERECO])
  vi.mocked(servicoPerfil.buscarPerfil).mockResolvedValue({
    email: 'ana@example.com',
    nome: 'Ana',
    sobrenome: 'Lima',
    telefone: '',
    nivel: 'usuario',
  })
  vi.mocked(servicoProdutos.listarProdutos).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        ...PRODUTO,
        estoque: 10,
        ativo: true,
        criado_em: '2026-09-19T00:00:00Z',
        atualizado_em: '2026-09-19T00:00:00Z',
      },
    ],
  })
  vi.mocked(servicoUsuarios.listarUsuarios).mockResolvedValue([
    {
      id: 1,
      email: 'ana@example.com',
      nome: 'Ana',
      sobrenome: 'Lima',
      telefone: '',
      nivel: 'admin',
      ativo: true,
      criado_em: '2026-09-18T19:38:00Z',
    },
  ])
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
    sessao.usuario = {
      email: 'ana@example.com',
      nome: 'Ana',
      sobrenome: '',
      telefone: '',
      nivel: 'admin',
    }

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

  it('paginação', async () => {
    const montado = mount(PaginacaoLista, {
      props: { pagina: 2, total: 60, porPagina: 20 },
      attachTo: document.body,
    })

    conferir(await auditar(montado))
    montado.unmount()
  })
})
