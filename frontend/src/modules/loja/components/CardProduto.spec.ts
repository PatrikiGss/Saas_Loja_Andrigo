import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import BlocoDoProduto from './BlocoDoProduto.vue'
import CardProduto from './CardProduto.vue'
import EspecificacoesProduto from './EspecificacoesProduto.vue'
import SeloCategoria from './SeloCategoria.vue'
import type { Produto } from '../types'

const PRODUTO: Produto = {
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
}

const Vazio = defineComponent({ setup: () => () => h('div') })

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/produto/:id', name: 'produto', component: Vazio }],
  })
}

function montarCard(produto: Produto = PRODUTO) {
  return mount(CardProduto, { props: { produto }, global: { plugins: [router()] } })
}

describe('CardProduto', () => {
  it('leva para a página do produto pelo id', () => {
    const card = montarCard()

    expect(card.get('a').attributes('href')).toBe('/produto/uuid-1')
  })

  it('mostra nome, marca e preço formatado', () => {
    const card = montarCard()

    expect(card.text()).toContain('Pod de menta')
    expect(card.text()).toContain('Elfbar')
    expect(card.text()).toContain('49,90')
  })

  it('diz por escrito quando está esgotado, e não só pela cor', () => {
    const card = montarCard({ ...PRODUTO, em_estoque: false })

    expect(card.text()).toContain('Esgotado')
    expect(card.get('.bloco').classes()).toContain('bloco--esgotado')
  })
})

describe('BlocoDoProduto', () => {
  it('pinta com o matiz da categoria e o tom do SKU', () => {
    const bloco = mount(BlocoDoProduto, {
      props: { categoria: 'essencia', sku: 'ESS-0001' },
    })

    const estilo = bloco.get('span').attributes('style') ?? ''
    expect(estilo).toContain('--matiz: var(--cat-essencia)')
    expect(estilo).toContain('--tom-base')
  })

  it('fica escondido do leitor de tela, porque não carrega informação', () => {
    // O que precisa ser lido está no texto do card; o bloco é o lugar da foto.
    const bloco = mount(BlocoDoProduto, { props: { categoria: 'vape', sku: 'X' } })

    expect(bloco.get('span').attributes('aria-hidden')).toBe('true')
  })
})

describe('EspecificacoesProduto', () => {
  it('mostra só o que veio preenchido', () => {
    const ficha = mount(EspecificacoesProduto, { props: { produto: PRODUTO } })

    expect(ficha.text()).toContain('Puffs')
    expect(ficha.text()).toContain('Nicotina')
    // Volume é nulo nesta categoria: 'Volume: —' não informaria nada.
    expect(ficha.text()).not.toContain('Volume')
  })

  it('acrescenta o tipo quando o nome do subtipo é conhecido', () => {
    const ficha = mount(EspecificacoesProduto, {
      props: { produto: PRODUTO, subtipo: 'Box' },
    })

    expect(ficha.text()).toContain('Tipo')
    expect(ficha.text()).toContain('Box')
  })

  it('some inteira quando a categoria não tem especificação alguma', () => {
    const ficha = mount(EspecificacoesProduto, {
      props: { produto: { ...PRODUTO, puffs: null, nicotina_mg_ml: null } },
    })

    expect(ficha.find('dl').exists()).toBe(false)
  })
})

describe('SeloCategoria', () => {
  it('põe a cor no quadrado e o nome em tinta', () => {
    // Texto colorido exigiria uma variante escura por matiz só para passar em
    // contraste; o quadrado já carrega o código de cor.
    const selo = mount(SeloCategoria, {
      props: { slug: 'essencia', nome: 'Essência' },
    })

    expect(selo.text()).toBe('Essência')
    expect(selo.get('.selo__cor').attributes('style')).toContain('var(--cat-essencia)')
    expect(selo.get('.selo__cor').attributes('aria-hidden')).toBe('true')
  })
})
