import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProdutoView from './ProdutoView.vue'
import * as servico from '../services/catalogo'
import { falhaComResposta } from '../../../testes/falhas'
import { umaEssencia, umSubtipo } from '../../../testes/fixtures'
import { montarNaRota, roteadorDeTeste } from '../../../testes/roteador'

vi.mock('../services/catalogo')
vi.mock('@/modules/carrinho/services/carrinho')

const PRODUTO = umaEssencia({
  sku: 'ESS-0001',
  nome: 'Nic salt menta',
  descricao: 'Essência de menta.',
  marca: 'Elfbar',
  preco: '49.90',
})

const SUBTIPOS = [umSubtipo('essencia-nic-salt', 'essencia', 'Nic salt')]

const ROTAS = {
  produto: '/produto/:id',
  catalogo: '/catalogo',
  entrar: '/entrar',
  carrinho: '/carrinho',
}

function montar(id = 'uuid-1') {
  return montarNaRota(ProdutoView, `/produto/${id}`, ROTAS)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(servico.buscarProduto).mockReset().mockResolvedValue(PRODUTO)
  vi.mocked(servico.listarSubtipos).mockReset().mockResolvedValue(SUBTIPOS)
})

describe('ProdutoView', () => {
  it('mostra nome, marca, preço e descrição', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Nic salt menta')
    expect(tela.text()).toContain('Elfbar')
    expect(tela.text()).toContain('49,90')
    expect(tela.text()).toContain('Essência de menta.')
  })

  it('traduz categoria e subtipo com o que veio da API', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Essência')
    expect(tela.text()).toContain('Nic salt')
    // Nunca o identificador cru.
    expect(tela.text()).not.toContain('essencia-nic-salt')
  })

  it('lista só as especificações que se aplicam à categoria', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('Volume')
    expect(tela.text()).toContain('Nicotina')
    expect(tela.text()).not.toContain('Puffs')
  })

  it('mostra o SKU do produto', async () => {
    const { tela } = await montar()

    expect(tela.text()).toContain('ESS-0001')
  })

  it('não mostra o texto interno do Django quando o produto não existe', async () => {
    vi.mocked(servico.buscarProduto).mockRejectedValue(
      falhaComResposta(404, { detail: 'No Produto matches the given query.' }),
    )

    const { tela } = await montar('nao-existe')

    expect(tela.text()).toContain('Não encontramos o que você procura.')
    expect(tela.text()).not.toContain('No Produto matches')
    expect(tela.text()).toContain('Voltar para o catálogo')
  })

  it('busca de novo quando o id da rota muda', async () => {
    const { router } = await montar()
    const antes = vi.mocked(servico.buscarProduto).mock.calls.length

    await router.push('/produto/uuid-2')
    await flushPromises()

    expect(vi.mocked(servico.buscarProduto).mock.calls.length).toBeGreaterThan(antes)
  })

  it('avisa enquanto carrega', async () => {
    vi.mocked(servico.buscarProduto).mockReturnValue(new Promise(() => {}))
    const router = roteadorDeTeste(ROTAS)
    await router.push('/produto/uuid-1')

    const tela = mount(ProdutoView, { global: { plugins: [router] } })
    await tela.vm.$nextTick()

    expect(tela.text()).toContain('Carregando')
  })

  it('diz que está sem estoque em vez de oferecer o botão', async () => {
    vi.mocked(servico.buscarProduto).mockResolvedValue({ ...PRODUTO, em_estoque: false })

    const { tela } = await montar()

    expect(tela.text()).toContain('sem estoque')
    expect(tela.find('button').exists()).toBe(false)
  })
})
