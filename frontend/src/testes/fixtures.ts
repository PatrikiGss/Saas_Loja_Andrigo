/**
 * Fábricas do que a API devolve, para os testes de unidade.
 *
 * Cada uma devolve um objeto completo, com a forma do esquema; o teste passa
 * só o que distingue o seu caso e herda o resto. Um campo novo no esquema se
 * acrescenta aqui uma vez, e não em cada arquivo que monta um pedido.
 *
 * Os padrões são comuns e coerentes entre si: o endereço é o marco zero de
 * São Paulo, o item do pedido é o do carrinho, e o total do pedido é o
 * subtotal mais o frete.
 */
import type { ProdutoGestao, UsuarioAdmin } from '@/modules/admin/types'
import type { Perfil } from '@/modules/auth/types'
import type { Carrinho, ItemCarrinho } from '@/modules/carrinho/types'
import type { Endereco } from '@/modules/enderecos/types'
import type { CategoriaSlug, Especificacao, Produto, Subtipo } from '@/modules/loja/types'
import type { EnderecoDeEntrega, Pedido, StatusPedido } from '@/modules/pedidos/types'
import type { Paginado } from '@/types/api'

export function paginaCom<T>(itens: T[], count = itens.length): Paginado<T> {
  return { count, next: null, previous: null, results: itens }
}

export function umPerfil(campos: Partial<Perfil> = {}): Perfil {
  return {
    email: 'ana@example.com',
    nome: 'Ana',
    sobrenome: 'Lima',
    telefone: '',
    nivel: 'usuario',
    ...campos,
  }
}

/** A conta como a gestão a vê: o perfil, mais o id, a situação e a data. */
export function umUsuarioAdmin(campos: Partial<UsuarioAdmin> = {}): UsuarioAdmin {
  return { id: 1, ...umPerfil(), ativo: true, criado_em: '2026-09-18T19:38:00Z', ...campos }
}

export function umaEntrega(campos: Partial<EnderecoDeEntrega> = {}): EnderecoDeEntrega {
  return {
    cep: '01001000',
    logradouro: 'Praça da Sé',
    numero: '100',
    complemento: '',
    bairro: 'Sé',
    cidade: 'São Paulo',
    uf: 'SP',
    ...campos,
  }
}

export function umEndereco(campos: Partial<Endereco> = {}): Endereco {
  return { id: 1, apelido: 'Casa', ...umaEntrega(), ...campos }
}

/** Nome e especificações de cada categoria, como o `loja/models.py` define. */
const CATEGORIAS: Record<CategoriaSlug, { nome: string; especificacoes: Especificacao[] }> = {
  pod_descartavel: { nome: 'Pod descartável', especificacoes: ['puffs', 'nicotina_mg_ml'] },
  pod_recarregavel: { nome: 'Pod recarregável', especificacoes: [] },
  vape: { nome: 'Vape', especificacoes: [] },
  essencia: { nome: 'Essência', especificacoes: ['volume_ml', 'nicotina_mg_ml'] },
  vaporizador_ervas: { nome: 'Vaporizador de ervas', especificacoes: [] },
}

export function umSubtipo(slug: string, categoria: CategoriaSlug, nome: string): Subtipo {
  const { nome: categoria_display, especificacoes } = CATEGORIAS[categoria]
  return { slug, nome, categoria, categoria_display, especificacoes: [...especificacoes] }
}

/** Um pod descartável: tem puffs e nicotina, e não tem volume. */
export function umProduto(campos: Partial<Produto> = {}): Produto {
  return {
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
    ...campos,
  }
}

/** Uma essência: tem volume e nicotina, e os puffs vêm nulos. */
export function umaEssencia(campos: Partial<Produto> = {}): Produto {
  return umProduto({
    sku: 'ESS-0001',
    nome: 'Nic salt menta',
    descricao: 'Essência de menta.',
    categoria: 'essencia',
    subtipo: 'essencia-nic-salt',
    puffs: null,
    volume_ml: '30.00',
    nicotina_mg_ml: '35.0',
    ...campos,
  })
}

export function umProdutoDeGestao(campos: Partial<ProdutoGestao> = {}): ProdutoGestao {
  return {
    ...umProduto(),
    estoque: 10,
    ativo: true,
    criado_em: '2026-09-19T00:00:00Z',
    atualizado_em: '2026-09-19T00:00:00Z',
    ...campos,
  }
}

type CamposDoItem = Partial<Omit<ItemCarrinho, 'produto'>> & {
  produto?: Partial<ItemCarrinho['produto']>
}

/** O subtotal sai do preço e da quantidade, salvo quando o teste o dá. */
export function umItemDeCarrinho({
  produto: doProduto,
  ...campos
}: CamposDoItem = {}): ItemCarrinho {
  const noCarrinho: ItemCarrinho['produto'] = {
    id: 'p1',
    sku: 'SKU-1',
    nome: 'Pod de menta',
    preco: '49.90',
    categoria: 'pod_descartavel',
    disponivel: true,
    ...doProduto,
  }
  const quantidade = campos.quantidade ?? 2
  return {
    id: 1,
    produto: noCarrinho,
    quantidade,
    subtotal: (Number(noCarrinho.preco) * quantidade).toFixed(2),
    ...campos,
  }
}

/** O total é a soma dos subtotais, como o servidor a faria. */
export function umCarrinho(itens: ItemCarrinho[] = [umItemDeCarrinho()]): Carrinho {
  const total = itens.reduce((soma, item) => soma + Number(item.subtotal), 0)
  return { itens, total: total.toFixed(2) }
}

/** O que o servidor manda em `proximos_status`: o `TRANSICOES` do backend. */
const PROXIMOS: Record<StatusPedido, StatusPedido[]> = {
  aguardando_pagamento: ['pago', 'cancelado'],
  pago: ['em_preparacao', 'cancelado'],
  em_preparacao: ['enviado', 'cancelado'],
  enviado: ['entregue'],
  entregue: [],
  cancelado: [],
}

/**
 * O que depende do status — próximos passos, pagamento e cancelamento — segue
 * o status pedido, como no servidor: passar para pago marca o pagamento, e só
 * o pedido que aguarda pagamento pode ser cancelado por quem comprou.
 */
export function umPedido(campos: Partial<Pedido> = {}): Pedido {
  const status = campos.status ?? 'aguardando_pagamento'
  const aguardando = status === 'aguardando_pagamento' || status === 'cancelado'
  return {
    numero: 'PED-20260919-ABCDEF',
    cliente: 'ana@example.com',
    status,
    status_pagamento: aguardando ? 'pendente' : 'pago',
    itens: [
      {
        sku: 'SKU-1',
        nome: 'Pod de menta',
        preco_unitario: '49.90',
        quantidade: 2,
        subtotal: '99.80',
      },
    ],
    entrega: umaEntrega(),
    servico_frete: 'economico',
    prazo_frete_em_dias: 4,
    subtotal: '99.80',
    frete: '19.90',
    total: '119.70',
    criado_em: '2026-09-19T02:07:30Z',
    pago_em: null,
    proximos_status: [...PROXIMOS[status]],
    pode_cancelar: status === 'aguardando_pagamento',
    ...campos,
  }
}
