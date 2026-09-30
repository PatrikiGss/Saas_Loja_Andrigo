import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LinhaDoCarrinho from './LinhaDoCarrinho.vue'
import { QUANTIDADE_MAXIMA, type ItemCarrinho } from '../types'

const ITEM: ItemCarrinho = {
  id: 7,
  produto: {
    id: 'produto-7',
    sku: 'SKU-7',
    nome: 'Pod de menta',
    preco: '49.90',
    categoria: 'pod_descartavel',
    disponivel: true,
  },
  quantidade: 2,
  subtotal: '99.80',
}

function montar(item: ItemCarrinho = ITEM, salvando = false) {
  return mount(LinhaDoCarrinho, { props: { item, salvando } })
}

/** [menos, mais, remover] — a ordem em que aparecem na linha. */
function botoes(linha: ReturnType<typeof montar>) {
  return linha.findAll('button')
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('LinhaDoCarrinho', () => {
  it('pinta o produto com a cor da categoria que o servidor mandou', () => {
    const bloco = montar().get('.bloco')

    expect(bloco.attributes('style')).toContain('--matiz: var(--cat-pod-descartavel)')
    expect(bloco.classes()).not.toContain('bloco--esgotado')
  })

  it('apaga a cor do produto indisponível', () => {
    const linha = montar({ ...ITEM, produto: { ...ITEM.produto, disponivel: false } })

    expect(linha.get('.bloco').classes()).toContain('bloco--esgotado')
  })

  it('espera antes de mandar, para quem clica várias vezes seguidas', async () => {
    const linha = montar()
    const [, mais] = botoes(linha)

    await mais.trigger('click')
    await mais.trigger('click')
    await mais.trigger('click')

    // Nada saiu ainda: só o último valor vale a viagem até a API.
    expect(linha.emitted('alterarQuantidade')).toBeUndefined()

    vi.advanceTimersByTime(500)

    expect(linha.emitted('alterarQuantidade')).toEqual([[7, 5]])
  })

  it('não desce abaixo de um: quem quer zero usa Remover', async () => {
    const linha = montar({ ...ITEM, quantidade: 1 })
    const [menos] = botoes(linha)

    expect(menos.attributes('disabled')).toBeDefined()
  })

  it('não passa do teto que o backend aceita', async () => {
    const linha = montar({ ...ITEM, quantidade: QUANTIDADE_MAXIMA })
    const [, mais] = botoes(linha)

    expect(mais.attributes('disabled')).toBeDefined()
  })

  it('prende o que a pessoa digita dentro da faixa', async () => {
    const linha = montar()

    await linha.get('input').setValue('999')
    vi.advanceTimersByTime(500)

    expect(linha.emitted('alterarQuantidade')).toEqual([[7, QUANTIDADE_MAXIMA]])
  })

  it('ignora digitação que não é número', async () => {
    const linha = montar()

    await linha.get('input').setValue('abc')
    vi.advanceTimersByTime(500)

    expect(linha.emitted('alterarQuantidade')).toBeUndefined()
  })

  it('não manda nada quando a quantidade volta para a que já estava', async () => {
    const linha = montar()
    const [menos, mais] = botoes(linha)

    await mais.trigger('click')
    await menos.trigger('click')
    vi.advanceTimersByTime(500)

    expect(linha.emitted('alterarQuantidade')).toBeUndefined()
  })

  it('pede a remoção pelo id do item', async () => {
    const linha = montar()
    const remover = botoes(linha).at(-1)!

    await remover.trigger('click')

    expect(linha.emitted('remover')).toEqual([[7]])
  })

  it('avisa quando o produto não passa mais no fechamento', () => {
    const linha = montar({ ...ITEM, produto: { ...ITEM.produto, disponivel: false } })

    expect(linha.text()).toContain('Indisponível')
  })

  it('marca o subtotal como em atualização enquanto o servidor recalcula', () => {
    const linha = montar(ITEM, true)

    expect(linha.get('.linha__subtotal').attributes('aria-busy')).toBe('true')
  })

  it('trava os controles enquanto salva', () => {
    const linha = montar(ITEM, true)

    for (const botao of botoes(linha)) {
      expect(botao.attributes('disabled')).toBeDefined()
    }
    expect(linha.get('input').attributes('disabled')).toBeDefined()
  })
})
