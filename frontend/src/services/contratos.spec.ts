/**
 * Conferência dos caminhos e parâmetros que os serviços montam.
 *
 * Nos testes de tela os serviços são substituídos por dublês, então um erro
 * de digitação numa URL ou um parâmetro com nome errado passaria batido: a
 * tela continuaria verde e só quebraria contra o backend de verdade. Aqui
 * cada função é conferida contra a rota que o `urls.py` publica.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DadosDeEndereco } from '@/modules/enderecos/types'
import { http } from './http'

vi.mock('./http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const put = vi.mocked(http.put)
const patch = vi.mocked(http.patch)
const remover = vi.mocked(http.delete)

/**
 * Respostas com a forma que a conferência exige.
 *
 * Os serviços agora recusam resposta fora do formato, então o dublê precisa
 * devolver algo com a cara do que a API devolve — o que é bom: um dublê vazio
 * demais escondia o que a aplicação de fato pressupõe.
 */
const PEDIDO = {
  numero: 'PED-1',
  status: 'aguardando_pagamento',
  status_pagamento: 'pendente',
  itens: [],
  entrega: {},
  subtotal: '10.00',
  frete: '19.90',
  total: '29.90',
}

const PRODUTO = {
  id: 'uuid-1',
  sku: 'SKU-1',
  nome: 'Produto',
  preco: '49.90',
  categoria: 'essencia',
  em_estoque: true,
}

const ITEM_DE_CARRINHO = { id: 1, produto: PRODUTO, quantidade: 1, subtotal: '49.90' }

function paginaVazia() {
  return { data: { count: 0, next: null, previous: null, results: [] } }
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue(paginaVazia())
  post.mockResolvedValue({ data: {} })
  put.mockResolvedValue({ data: {} })
  patch.mockResolvedValue({ data: {} })
  remover.mockResolvedValue({ data: null })
})

describe('autenticação', () => {
  it('bate nas rotas de /api/auth/ e desliga a renovação onde 401 é resposta', async () => {
    const auth = await import('@/modules/auth/services/auth')
    post.mockResolvedValue({ data: { access: 'token' } })

    await auth.autenticar({ email: 'a@b.c', password: 'x' })
    expect(post).toHaveBeenCalledWith(
      '/auth/login/',
      { email: 'a@b.c', password: 'x' },
      { semRenovacao: true },
    )

    await auth.renovarAcesso()
    expect(post).toHaveBeenCalledWith('/auth/refresh/', {}, { semRenovacao: true })

    await auth.encerrarSessao()
    expect(post).toHaveBeenCalledWith('/auth/logout/', {}, { semRenovacao: true })

    await auth.cadastrar({ email: 'a@b.c', password: 'x', nome: 'A' })
    expect(post).toHaveBeenCalledWith(
      '/auth/cadastro/',
      { email: 'a@b.c', password: 'x', nome: 'A' },
      { semRenovacao: true },
    )

    await auth.ativarConta({ uid: 'Mg', token: 'abc' })
    expect(post).toHaveBeenCalledWith(
      '/auth/ativar/',
      { uid: 'Mg', token: 'abc' },
      { semRenovacao: true },
    )

    await auth.pedirRecuperacao('a@b.c')
    expect(post).toHaveBeenCalledWith(
      '/auth/senha/recuperar/',
      { email: 'a@b.c' },
      { semRenovacao: true },
    )

    await auth.redefinirSenha({ uid: 'Mg', token: 'abc' }, 'nova')
    expect(post).toHaveBeenCalledWith(
      '/auth/senha/redefinir/',
      { uid: 'Mg', token: 'abc', nova_senha: 'nova' },
      { semRenovacao: true },
    )

    // A troca de senha é autenticada: aqui 401 é sessão vencida de verdade.
    await auth.alterarSenha('velha', 'nova')
    expect(post).toHaveBeenCalledWith('/auth/senha/', {
      senha_atual: 'velha',
      nova_senha: 'nova',
    })

    get.mockResolvedValue({ data: { email: 'a@b.c', nivel: 'usuario' } })
    await auth.buscarPerfil()
    expect(get).toHaveBeenCalledWith('/perfil/')
  })
})

describe('catálogo', () => {
  it('lista e busca produtos', async () => {
    const catalogo = await import('@/modules/loja/services/catalogo')

    await catalogo.listarProdutos({ categoria: 'essencia', pagina: 2 })
    expect(get).toHaveBeenCalledWith('/produtos/', {
      params: { categoria: 'essencia', page: '2' },
    })

    get.mockResolvedValue({ data: PRODUTO })
    await catalogo.buscarProduto('uuid-1')
    expect(get).toHaveBeenCalledWith('/produtos/uuid-1/')
  })

  it('percorre as páginas de subtipos', async () => {
    const catalogo = await import('@/modules/loja/services/catalogo')

    await catalogo.listarSubtipos()

    expect(get).toHaveBeenCalledWith('/subtipos/')
  })
})

describe('carrinho', () => {
  it('bate nas rotas de item e de coleção', async () => {
    const carrinho = await import('@/modules/carrinho/services/carrinho')

    get.mockResolvedValue({ data: { itens: [], total: '0' } })
    await carrinho.buscarCarrinho()
    expect(get).toHaveBeenCalledWith('/carrinho/')

    post.mockResolvedValue({ data: ITEM_DE_CARRINHO })
    await carrinho.adicionarItem('uuid-1', 2)
    expect(post).toHaveBeenCalledWith('/carrinho/itens/', { produto: 'uuid-1', quantidade: 2 })

    patch.mockResolvedValue({ data: ITEM_DE_CARRINHO })
    await carrinho.alterarQuantidade(7, 3)
    expect(patch).toHaveBeenCalledWith('/carrinho/itens/7/', { quantidade: 3 })

    await carrinho.removerItem(7)
    expect(remover).toHaveBeenCalledWith('/carrinho/itens/7/')

    // Esvaziar é DELETE na coleção, não item a item.
    await carrinho.esvaziar()
    expect(remover).toHaveBeenCalledWith('/carrinho/itens/')
  })
})

describe('endereços e CEP', () => {
  it('bate nas rotas e manda o CEP só com dígitos', async () => {
    const enderecos = await import('@/modules/enderecos/services/enderecos')
    const dados: DadosDeEndereco = {
      apelido: 'Casa',
      cep: '01001000',
      logradouro: 'Praça da Sé',
      numero: '100',
      complemento: '',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    }

    await enderecos.listarEnderecos()
    expect(get).toHaveBeenCalledWith('/enderecos/')

    await enderecos.criarEndereco(dados)
    expect(post).toHaveBeenCalledWith('/enderecos/', dados)

    await enderecos.atualizarEndereco(3, { numero: '200' })
    expect(patch).toHaveBeenCalledWith('/enderecos/3/', { numero: '200' })

    await enderecos.removerEndereco(3)
    expect(remover).toHaveBeenCalledWith('/enderecos/3/')

    get.mockResolvedValue({ data: {} })
    await enderecos.consultarCep('01001-000')
    expect(get).toHaveBeenCalledWith('/cep/01001000/')
  })
})

describe('checkout', () => {
  it('manda só o id do endereço e o identificador do serviço', async () => {
    const checkout = await import('@/modules/checkout/services/checkout')

    post.mockResolvedValue({ data: [] })
    await checkout.cotarFrete(3)
    expect(post).toHaveBeenCalledWith('/frete/cotacao/', { endereco: 3 })

    post.mockResolvedValue({ data: PEDIDO })
    await checkout.fecharPedido(3, 'expresso')
    expect(post).toHaveBeenCalledWith('/checkout/', { endereco: 3, servico: 'expresso' })
  })
})

describe('perfil', () => {
  it('lê e atualiza sem id na URL', async () => {
    const perfil = await import('@/modules/perfil/services/perfil')

    get.mockResolvedValue({ data: { email: 'a@b.c', nivel: 'usuario' } })
    await perfil.buscarPerfil()
    expect(get).toHaveBeenCalledWith('/perfil/')

    await perfil.atualizarPerfil({ nome: 'A', sobrenome: 'B', telefone: '1' })
    expect(patch).toHaveBeenCalledWith('/perfil/', { nome: 'A', sobrenome: 'B', telefone: '1' })
  })
})

describe('gestão', () => {
  it('usa as mesmas rotas do cliente, que o backend abre para admin', async () => {
    const produtos = await import('@/modules/admin/services/produtos')

    await produtos.listarProdutos({ busca: 'menta' })
    expect(get).toHaveBeenCalledWith('/produtos/', { params: { search: 'menta' } })

    get.mockResolvedValue({ data: PRODUTO })
    await produtos.buscarProduto('uuid-1')
    expect(get).toHaveBeenCalledWith('/produtos/uuid-1/')

    post.mockResolvedValue({ data: { estoque: 5 } })
    expect(await produtos.ajustarEstoque('uuid-1', -2)).toBe(5)
    expect(post).toHaveBeenCalledWith('/produtos/uuid-1/estoque/', { delta: -2 })

    await produtos.removerProduto('uuid-1')
    expect(remover).toHaveBeenCalledWith('/produtos/uuid-1/')
  })

  it('edita produto com PUT, que é o verbo do formulário inteiro', async () => {
    const produtos = await import('@/modules/admin/services/produtos')
    const dados = {
      sku: 'POD-0001',
      nome: 'Pod',
      descricao: '',
      marca: 'M',
      subtipo: 'descartavel-box',
      preco: '49.90',
      ativo: true,
      puffs: 600,
      volume_ml: null,
      nicotina_mg_ml: null,
    }

    await produtos.criarProduto(dados)
    expect(post).toHaveBeenCalledWith('/produtos/', dados)

    await produtos.atualizarProduto('uuid-1', dados)
    expect(put).toHaveBeenCalledWith('/produtos/uuid-1/', dados)
  })

  it('separa a troca de nível do PATCH da conta', async () => {
    const usuarios = await import('@/modules/admin/services/usuarios')

    await usuarios.listarUsuarios()
    expect(get).toHaveBeenCalledWith('/usuarios/')

    await usuarios.definirAtivo(4, false)
    expect(patch).toHaveBeenCalledWith('/usuarios/4/', { ativo: false })

    // Mudar privilégio tem endpoint próprio no backend.
    post.mockResolvedValue({ data: { nivel: 'admin' } })
    expect(await usuarios.definirNivel(4, 'admin')).toBe('admin')
    expect(post).toHaveBeenCalledWith('/usuarios/4/nivel/', { nivel: 'admin' })
  })

  it('move o pedido pelo número, não por id', async () => {
    const pedidos = await import('@/modules/admin/services/pedidos')

    post.mockResolvedValue({ data: PEDIDO })
    await pedidos.alterarStatus('PED-20260919-ABCDEF', 'pago')

    expect(post).toHaveBeenCalledWith('/pedidos/PED-20260919-ABCDEF/status/', { status: 'pago' })
  })
})
