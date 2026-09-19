/**
 * Telas de gestão de pedidos, contas e cadastro de produto.
 *
 * Dividem o mesmo preparo — roteador de memória e serviços substituídos —
 * então ficam juntas em vez de repetir a montagem em três arquivos.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useSessao } from '@/modules/auth/stores/sessao'
import * as servicoCatalogo from '@/modules/loja/services/catalogo'
import * as servicoPedidosCliente from '@/modules/pedidos/services/pedidos'
import type { Pedido, StatusPedido } from '@/modules/pedidos/types'
import PedidosView from './PedidosView.vue'
import ProdutoFormView from './ProdutoFormView.vue'
import UsuariosView from './UsuariosView.vue'
import * as servicoPedidosAdmin from '../services/pedidos'
import * as servicoProdutos from '../services/produtos'
import * as servicoUsuarios from '../services/usuarios'
import type { ProdutoGestao, UsuarioAdmin } from '../types'

vi.mock('../services/pedidos')
vi.mock('../services/produtos')
vi.mock('../services/usuarios')
vi.mock('@/modules/pedidos/services/pedidos')
vi.mock('@/modules/loja/services/catalogo')

function pedido(numero: string, status: StatusPedido = 'aguardando_pagamento'): Pedido {
  return {
    numero,
    status,
    status_pagamento: 'pendente',
    itens: [],
    entrega: {
      cep: '01001000',
      logradouro: 'R',
      numero: '1',
      complemento: '',
      bairro: 'B',
      cidade: 'C',
      uf: 'SP',
    },
    servico_frete: 'economico',
    prazo_frete_em_dias: 4,
    subtotal: '10.00',
    frete: '19.90',
    total: '29.90',
    criado_em: '2026-09-19T02:07:30Z',
    pago_em: null,
  }
}

function usuario(id: number, email: string, nivel: UsuarioAdmin['nivel'] = 'usuario'): UsuarioAdmin {
  return {
    id,
    email,
    nome: 'Nome',
    sobrenome: 'Sobrenome',
    telefone: '',
    nivel,
    ativo: true,
    criado_em: '2026-09-18T19:38:00Z',
  }
}

const PRODUTO: ProdutoGestao = {
  id: 'uuid-1',
  sku: 'POD-0001',
  nome: 'Pod de menta',
  descricao: 'Descrição',
  marca: 'Elfbar',
  categoria: 'pod_descartavel',
  subtipo: 'descartavel-box',
  preco: '49.90',
  em_estoque: true,
  puffs: 600,
  volume_ml: null,
  nicotina_mg_ml: '50.0',
  estoque: 10,
  ativo: true,
  criado_em: '2026-09-19T00:00:00Z',
  atualizado_em: '2026-09-19T00:00:00Z',
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function criarRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/produtos', name: 'admin-produtos', component: Vazio },
      { path: '/admin/produtos/novo', name: 'admin-produto-novo', component: Vazio },
      { path: '/admin/produtos/:id', name: 'admin-produto', component: Vazio },
      { path: '/admin/pedidos', name: 'admin-pedidos', component: Vazio },
      { path: '/admin/usuarios', name: 'admin-usuarios', component: Vazio },
      { path: '/pedidos/:numero', name: 'pedido', component: Vazio },
    ],
  })
}

async function montar(tela: Component, caminho: string) {
  const router = criarRouter()
  await router.push(caminho)
  await router.isReady()

  const montada = mount(tela, { global: { plugins: [router] } })
  await flushPromises()
  return { montada, router }
}

async function clicar(tela: ReturnType<typeof mount>, texto: string) {
  await tela.findAll('button').find((b) => b.text().includes(texto))!.trigger('click')
  await flushPromises()
}

function erroDeApi(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('falhou', String(status), config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse)
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
  vi.clearAllMocks()
  vi.mocked(servicoPedidosCliente.listarPedidos).mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [pedido('PED-1')],
  })
  vi.mocked(servicoPedidosAdmin.alterarStatus).mockResolvedValue(pedido('PED-1', 'pago'))
  vi.mocked(servicoUsuarios.listarUsuarios).mockResolvedValue([
    usuario(1, 'ana@example.com', 'admin'),
    usuario(2, 'bruno@example.com'),
  ])
  vi.mocked(servicoUsuarios.definirAtivo).mockResolvedValue(usuario(2, 'bruno@example.com'))
  vi.mocked(servicoUsuarios.definirNivel).mockResolvedValue('admin')
  vi.mocked(servicoProdutos.buscarProduto).mockResolvedValue(PRODUTO)
  vi.mocked(servicoProdutos.criarProduto).mockResolvedValue(PRODUTO)
  vi.mocked(servicoProdutos.atualizarProduto).mockResolvedValue(PRODUTO)
  vi.mocked(servicoCatalogo.listarSubtipos).mockResolvedValue([
    {
      slug: 'descartavel-box',
      nome: 'Box',
      categoria: 'pod_descartavel',
      categoria_display: 'Pod descartável',
    },
  ])
})

describe('gestão de pedidos', () => {
  it('lista os pedidos com status e total', async () => {
    const { montada } = await montar(PedidosView, '/admin/pedidos')

    expect(montada.text()).toContain('PED-1')
    expect(montada.text()).toContain('Aguardando pagamento')
    expect(montada.text()).toContain('29,90')
  })

  it('oferece todos os status, sem copiar o mapa de transições do backend', async () => {
    const { montada } = await montar(PedidosView, '/admin/pedidos')
    const opcoes = montada.get('select').findAll('option').map((o) => o.text())

    expect(opcoes).toEqual([
      'Escolha',
      'Aguardando pagamento',
      'Pago',
      'Em preparação',
      'Enviado',
      'Entregue',
      'Cancelado',
    ])
  })

  it('desabilita o status em que o pedido já está', async () => {
    const { montada } = await montar(PedidosView, '/admin/pedidos')
    const atual = montada
      .get('select')
      .findAll('option')
      .find((o) => o.text() === 'Aguardando pagamento')!

    expect(atual.attributes('disabled')).toBeDefined()
  })

  it('move o pedido para o status escolhido', async () => {
    const { montada } = await montar(PedidosView, '/admin/pedidos')

    await montada.get('select').setValue('pago')
    await clicar(montada, 'Aplicar')

    expect(servicoPedidosAdmin.alterarStatus).toHaveBeenCalledWith('PED-1', 'pago')
  })

  it('escreve a recusa com os rótulos, e não com os identificadores', async () => {
    vi.mocked(servicoPedidosAdmin.alterarStatus).mockRejectedValue(
      erroDeApi(400, {
        status: ['Não é possível ir de aguardando_pagamento para enviado.'],
      }),
    )
    const { montada } = await montar(PedidosView, '/admin/pedidos')

    await montada.get('select').setValue('enviado')
    await clicar(montada, 'Aplicar')

    expect(montada.text()).toContain('Não dá para ir de “Aguardando pagamento” para “Enviado”.')
    expect(montada.text()).not.toContain('aguardando_pagamento')
  })

  it('não aplica sem escolher destino', async () => {
    const { montada } = await montar(PedidosView, '/admin/pedidos')
    const aplicar = montada.findAll('button').find((b) => b.text().includes('Aplicar'))!

    expect(aplicar.attributes('disabled')).toBeDefined()
  })

  it('diz que ainda não há pedido', async () => {
    vi.mocked(servicoPedidosCliente.listarPedidos).mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })

    const { montada } = await montar(PedidosView, '/admin/pedidos')

    expect(montada.text()).toContain('Nenhum pedido ainda')
  })
})

describe('gestão de contas', () => {
  it('lista com nível e situação em texto legível', async () => {
    const { montada } = await montar(UsuariosView, '/admin/usuarios')

    expect(montada.text()).toContain('ana@example.com')
    expect(montada.text()).toContain('Admin')
    expect(montada.text()).toContain('Cliente')
    expect(montada.text()).toContain('Ativa')
  })

  it('marca qual é a conta de quem está olhando', async () => {
    const sessao = useSessao()
    sessao.usuario = {
      email: 'ana@example.com',
      nome: 'Ana',
      sobrenome: '',
      telefone: '',
      nivel: 'admin',
    }

    const { montada } = await montar(UsuariosView, '/admin/usuarios')

    expect(montada.text()).toContain('esta é a sua conta')
  })

  it('desativa pelo PATCH da conta', async () => {
    const { montada } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(montada, 'Desativar')

    expect(servicoUsuarios.definirAtivo).toHaveBeenCalledWith(1, false)
  })

  it('mostra a recusa própria do backend, e não a mensagem genérica de permissão', async () => {
    // É por isto que `detalheDoServidor` existe: aqui o 403 vem com texto
    // escrito pelo domínio, em português.
    vi.mocked(servicoUsuarios.definirAtivo).mockRejectedValue(
      erroDeApi(403, { detail: 'A própria conta não se altera por aqui.' }),
    )
    const { montada } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(montada, 'Desativar')

    expect(montada.text()).toContain('A própria conta não se altera por aqui.')
  })

  it('pede confirmação antes de mudar o nível', async () => {
    const { montada } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(montada, 'Tornar admin')

    expect(servicoUsuarios.definirNivel).not.toHaveBeenCalled()
    expect(montada.text()).toContain('produtos, pedidos e contas de todo mundo')
  })

  it('promove ao confirmar, pelo endpoint próprio de nível', async () => {
    const { montada } = await montar(UsuariosView, '/admin/usuarios')
    await clicar(montada, 'Tornar admin')

    const confirmar = montada
      .get('dialog')
      .findAll('button')
      .find((b) => b.text().includes('Tornar admin'))!
    await confirmar.trigger('click')
    await flushPromises()

    expect(servicoUsuarios.definirNivel).toHaveBeenCalledWith(2, 'admin')
  })

  it('rebaixa quem já é admin', async () => {
    const { montada } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(montada, 'Rebaixar')

    expect(montada.text()).toContain('perde acesso à gestão')
  })
})

describe('cadastro de produto', () => {
  it('abre vazio na rota de novo', async () => {
    const { montada } = await montar(ProdutoFormView, '/admin/produtos/novo')

    expect(montada.text()).toContain('Cadastrar produto')
    expect(servicoProdutos.buscarProduto).not.toHaveBeenCalled()
  })

  it('abre preenchido ao editar', async () => {
    const { montada } = await montar(ProdutoFormView, '/admin/produtos/uuid-1')

    expect(montada.text()).toContain('Editar produto')
    expect(servicoProdutos.buscarProduto).toHaveBeenCalledWith('uuid-1')

    const sku = montada.findAll('.campo').find((c) => c.text().startsWith('SKU'))!
    expect((sku.get('input').element as HTMLInputElement).value).toBe('POD-0001')
  })

  it('mostra as três especificações, sem copiar a regra por categoria', async () => {
    // Quais valem é regra do backend e não há endpoint que a publique;
    // ele recusa no campo o que não se aplica.
    const { montada } = await montar(ProdutoFormView, '/admin/produtos/novo')

    expect(montada.text()).toContain('Puffs')
    expect(montada.text()).toContain('Volume (ml)')
    expect(montada.text()).toContain('Nicotina (mg/ml)')
  })

  it('cria e leva para a edição do que foi salvo', async () => {
    const { montada, router } = await montar(ProdutoFormView, '/admin/produtos/novo')

    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servicoProdutos.criarProduto).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/admin/produtos/uuid-1')
  })

  it('edita com PUT em vez de criar outro', async () => {
    const { montada } = await montar(ProdutoFormView, '/admin/produtos/uuid-1')

    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(servicoProdutos.atualizarProduto).toHaveBeenCalledWith('uuid-1', expect.anything())
    expect(servicoProdutos.criarProduto).not.toHaveBeenCalled()
  })

  it('mostra a recusa do backend no campo da especificação', async () => {
    vi.mocked(servicoProdutos.criarProduto).mockRejectedValue(
      erroDeApi(400, { puffs: ['Não se aplica a esta categoria.'] }),
    )
    const { montada } = await montar(ProdutoFormView, '/admin/produtos/novo')

    await montada.get('form').trigger('submit')
    await flushPromises()

    expect(montada.text()).toContain('Não se aplica a esta categoria.')
  })
})
