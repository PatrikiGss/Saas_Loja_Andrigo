/**
 * Telas de gestão de pedidos, contas e cadastro de produto.
 *
 * Dividem o mesmo preparo — roteador de memória e serviços substituídos —
 * então ficam juntas em vez de repetir a montagem em três arquivos.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Component } from 'vue'

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
import type { UsuarioAdmin } from '../types'
import { falhaComResposta } from '../../../testes/falhas'
import {
  paginaCom,
  umPedido,
  umPerfil,
  umProdutoDeGestao,
  umSubtipo,
  umUsuarioAdmin,
} from '../../../testes/fixtures'
import { montarNaRota } from '../../../testes/roteador'

vi.mock('../services/pedidos')
vi.mock('../services/produtos')
vi.mock('../services/usuarios')
vi.mock('@/modules/pedidos/services/pedidos')
vi.mock('@/modules/loja/services/catalogo')

/** Com o dono no e-mail, para a coluna de cliente ter o que mostrar. */
function pedido(numero: string, status: StatusPedido = 'aguardando_pagamento'): Pedido {
  return umPedido({
    numero,
    status,
    cliente: `dono-de-${numero.toLowerCase()}@example.com`,
    subtotal: '10.00',
    total: '29.90',
  })
}

function usuario(
  id: number,
  email: string,
  nivel: UsuarioAdmin['nivel'] = 'usuario',
): UsuarioAdmin {
  return umUsuarioAdmin({ id, email, nivel })
}

const PRODUTO = umProdutoDeGestao()

const ROTAS = {
  'admin-produtos': '/admin/produtos',
  'admin-produto-novo': '/admin/produtos/novo',
  'admin-produto': '/admin/produtos/:id',
  'admin-pedidos': '/admin/pedidos',
  'admin-usuarios': '/admin/usuarios',
  pedido: '/pedidos/:numero',
}

function montar(componente: Component, caminho: string) {
  return montarNaRota(componente, caminho, ROTAS)
}

async function clicar(tela: ReturnType<typeof mount>, texto: string) {
  await tela
    .findAll('button')
    .find((b) => b.text().includes(texto))!
    .trigger('click')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(servicoPedidosCliente.listarPedidos).mockResolvedValue(paginaCom([pedido('PED-1')]))
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
    umSubtipo('descartavel-box', 'pod_descartavel', 'Box'),
  ])
})

describe('gestão de pedidos', () => {
  it('lista os pedidos com status e total', async () => {
    const { tela } = await montar(PedidosView, '/admin/pedidos')

    expect(tela.text()).toContain('PED-1')
    expect(tela.text()).toContain('Aguardando pagamento')
    expect(tela.text()).toContain('29,90')
  })

  it('mostra de quem é cada pedido', async () => {
    const { tela } = await montar(PedidosView, '/admin/pedidos')

    expect(tela.text()).toContain('dono-de-ped-1@example.com')
  })

  it('oferece só os status que o servidor aceita a partir do atual', async () => {
    const { tela } = await montar(PedidosView, '/admin/pedidos')
    const opcoes = tela
      .get('select')
      .findAll('option')
      .map((o) => o.text())

    expect(opcoes).toEqual(['Escolha', 'Pago', 'Cancelado'])
  })

  it('pedido encerrado não tem seletor', async () => {
    vi.mocked(servicoPedidosCliente.listarPedidos).mockResolvedValue(
      paginaCom([pedido('PED-9', 'entregue')]),
    )

    const { tela } = await montar(PedidosView, '/admin/pedidos')

    expect(tela.find('select').exists()).toBe(false)
    expect(tela.text()).toContain('Encerrado')
  })

  it('move o pedido para o status escolhido', async () => {
    const { tela } = await montar(PedidosView, '/admin/pedidos')

    await tela.get('select').setValue('pago')
    await clicar(tela, 'Aplicar')

    expect(servicoPedidosAdmin.alterarStatus).toHaveBeenCalledWith('PED-1', 'pago')
  })

  it('escreve a recusa com os rótulos, e não com os identificadores', async () => {
    // Outra pessoa da equipe cancelou o pedido entre a listagem e o clique.
    vi.mocked(servicoPedidosAdmin.alterarStatus).mockRejectedValue(
      falhaComResposta(400, {
        status: ['Não é possível ir de cancelado para pago.'],
      }),
    )
    const { tela } = await montar(PedidosView, '/admin/pedidos')

    await tela.get('select').setValue('pago')
    await clicar(tela, 'Aplicar')

    expect(tela.text()).toContain('Não dá para ir de “Aguardando pagamento” para “Pago”.')
    expect(tela.text()).not.toContain('aguardando_pagamento')
  })

  it('falha que não é de transição fica com a mensagem geral', async () => {
    vi.mocked(servicoPedidosAdmin.alterarStatus).mockRejectedValue(falhaComResposta(500, {}))
    const { tela } = await montar(PedidosView, '/admin/pedidos')

    await tela.get('select').setValue('pago')
    await clicar(tela, 'Aplicar')

    expect(tela.find('[role="alert"]').exists()).toBe(true)
    expect(tela.text()).not.toContain('Não dá para ir de')
  })

  it('não aplica sem escolher destino', async () => {
    const { tela } = await montar(PedidosView, '/admin/pedidos')
    const aplicar = tela.findAll('button').find((b) => b.text().includes('Aplicar'))!

    expect(aplicar.attributes('disabled')).toBeDefined()
  })

  it('diz que ainda não há pedido', async () => {
    vi.mocked(servicoPedidosCliente.listarPedidos).mockResolvedValue(paginaCom([]))

    const { tela } = await montar(PedidosView, '/admin/pedidos')

    expect(tela.text()).toContain('Nenhum pedido ainda')
  })
})

describe('gestão de contas', () => {
  it('lista com nível e situação em texto legível', async () => {
    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    expect(tela.text()).toContain('ana@example.com')
    expect(tela.text()).toContain('Admin')
    expect(tela.text()).toContain('Cliente')
    expect(tela.text()).toContain('Ativa')
  })

  it('marca qual é a conta de quem está olhando', async () => {
    const sessao = useSessao()
    sessao.usuario = umPerfil({ email: 'ana@example.com', nivel: 'admin' })

    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    expect(tela.text()).toContain('esta é a sua conta')
  })

  it('desativa pelo PATCH da conta', async () => {
    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(tela, 'Desativar')

    expect(servicoUsuarios.definirAtivo).toHaveBeenCalledWith(1, false)
  })

  it('reativa conta desativada, e diz que ela está desativada', async () => {
    vi.mocked(servicoUsuarios.listarUsuarios).mockResolvedValue([
      { ...usuario(3, 'carla@example.com'), ativo: false },
    ])
    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    expect(tela.text()).toContain('Desativada')
    await clicar(tela, 'Reativar')

    expect(servicoUsuarios.definirAtivo).toHaveBeenCalledWith(3, true)
  })

  it('mostra a recusa própria do backend, e não a mensagem genérica de permissão', async () => {
    // É por isto que `detalheDoServidor` existe: aqui o 403 vem com texto
    // escrito pelo domínio, em português.
    vi.mocked(servicoUsuarios.definirAtivo).mockRejectedValue(
      falhaComResposta(403, { detail: 'A própria conta não se altera por aqui.' }),
    )
    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(tela, 'Desativar')

    expect(tela.text()).toContain('A própria conta não se altera por aqui.')
  })

  it('pede confirmação antes de mudar o nível', async () => {
    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(tela, 'Tornar admin')

    expect(servicoUsuarios.definirNivel).not.toHaveBeenCalled()
    expect(tela.text()).toContain('produtos, pedidos e contas de todo mundo')
  })

  it('promove ao confirmar, pelo endpoint próprio de nível', async () => {
    const { tela } = await montar(UsuariosView, '/admin/usuarios')
    await clicar(tela, 'Tornar admin')

    const confirmar = tela
      .get('dialog')
      .findAll('button')
      .find((b) => b.text().includes('Tornar admin'))!
    await confirmar.trigger('click')
    await flushPromises()

    expect(servicoUsuarios.definirNivel).toHaveBeenCalledWith(2, 'admin')
  })

  it('rebaixa quem já é admin', async () => {
    const { tela } = await montar(UsuariosView, '/admin/usuarios')

    await clicar(tela, 'Rebaixar')

    expect(tela.text()).toContain('perde acesso à gestão')
  })
})

describe('cadastro de produto', () => {
  it('abre vazio na rota de novo', async () => {
    const { tela } = await montar(ProdutoFormView, '/admin/produtos/novo')

    expect(tela.text()).toContain('Cadastrar produto')
    expect(servicoProdutos.buscarProduto).not.toHaveBeenCalled()
  })

  it('abre preenchido ao editar', async () => {
    const { tela } = await montar(ProdutoFormView, '/admin/produtos/uuid-1')

    expect(tela.text()).toContain('Editar produto')
    expect(servicoProdutos.buscarProduto).toHaveBeenCalledWith('uuid-1')

    const sku = tela.findAll('.campo').find((c) => c.text().startsWith('SKU'))!
    expect((sku.get('input').element as HTMLInputElement).value).toBe('POD-0001')
  })

  it('mostra as três especificações, sem copiar a regra por categoria', async () => {
    // Quais valem é regra do backend e não há endpoint que a publique;
    // ele recusa no campo o que não se aplica.
    const { tela } = await montar(ProdutoFormView, '/admin/produtos/novo')

    expect(tela.text()).toContain('Puffs')
    expect(tela.text()).toContain('Volume (ml)')
    expect(tela.text()).toContain('Nicotina (mg/ml)')
  })

  it('cria e leva para a edição do que foi salvo', async () => {
    const { tela, router } = await montar(ProdutoFormView, '/admin/produtos/novo')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servicoProdutos.criarProduto).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/admin/produtos/uuid-1')
  })

  it('edita com PUT em vez de criar outro', async () => {
    const { tela } = await montar(ProdutoFormView, '/admin/produtos/uuid-1')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(servicoProdutos.atualizarProduto).toHaveBeenCalledWith('uuid-1', expect.anything())
    expect(servicoProdutos.criarProduto).not.toHaveBeenCalled()
  })

  it('mostra a recusa do backend no campo da especificação', async () => {
    vi.mocked(servicoProdutos.criarProduto).mockRejectedValue(
      falhaComResposta(400, { puffs: ['Não se aplica a esta categoria.'] }),
    )
    const { tela } = await montar(ProdutoFormView, '/admin/produtos/novo')

    await tela.get('form').trigger('submit')
    await flushPromises()

    expect(tela.text()).toContain('Não se aplica a esta categoria.')
  })
})
