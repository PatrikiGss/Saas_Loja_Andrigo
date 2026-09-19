import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { ErroDaApi } from '@/services/erros'
import PassosDoCheckout from './PassosDoCheckout.vue'
import SelecaoDeFrete from './SelecaoDeFrete.vue'
import type { OpcaoFrete, Passo } from '../types'

const OPCOES: OpcaoFrete[] = [
  { servico: 'economico', nome: 'Econômico', preco: '19.90', prazo_em_dias: 4 },
  { servico: 'expresso', nome: 'Expresso', preco: '35.82', prazo_em_dias: 1 },
]

function montarPassos(atual: Passo) {
  return mount(PassosDoCheckout, { props: { atual } })
}

function montarFrete(props: Record<string, unknown> = {}) {
  return mount(SelecaoDeFrete, {
    props: { opcoes: OPCOES, selecionado: null, carregando: false, erro: null, ...props },
  })
}

describe('PassosDoCheckout', () => {
  it('numera os três passos na ordem em que acontecem', () => {
    const passos = montarPassos('endereco')

    expect(passos.findAll('.passo')).toHaveLength(3)
    expect(passos.text()).toContain('1')
    expect(passos.text()).toContain('Endereço')
    expect(passos.text()).toContain('Resumo')
  })

  it('marca o passo atual para o leitor de tela', () => {
    const passos = montarPassos('entrega')

    expect(passos.get('.passo--atual').attributes('aria-current')).toBe('step')
    expect(passos.get('.passo--atual').text()).toContain('Entrega')
  })

  it('deixa voltar ao que já foi cumprido, e não ao que vem depois', async () => {
    // O passo à frente depende do que ainda não foi escolhido.
    const passos = montarPassos('resumo')

    expect(passos.findAll('.passo--cumprido')).toHaveLength(2)
    expect(passos.findAll('button')).toHaveLength(2)

    await passos.findAll('button')[0].trigger('click')

    expect(passos.emitted('voltarPara')).toEqual([['endereco']])
  })

  it('não oferece volta nenhuma no primeiro passo', () => {
    expect(montarPassos('endereco').findAll('button')).toHaveLength(0)
  })
})

describe('SelecaoDeFrete', () => {
  it('mostra nome, prazo e preço de cada opção', () => {
    const frete = montarFrete()

    expect(frete.text()).toContain('Econômico')
    expect(frete.text()).toContain('4 dias úteis')
    expect(frete.text()).toContain('19,90')
    expect(frete.text()).toContain('35,82')
  })

  it('usa o singular num prazo de um dia', () => {
    const frete = montarFrete()

    expect(frete.text()).toContain('1 dia útil')
    expect(frete.text()).not.toContain('1 dias úteis')
  })

  it('avisa qual serviço foi escolhido', async () => {
    const frete = montarFrete()

    await frete.findAll('input[type="radio"]')[1].setValue()

    expect(frete.emitted('escolher')).toEqual([['expresso']])
  })

  it('não deixa continuar sem escolher', () => {
    const frete = montarFrete()
    const continuar = frete.findAll('button').find((b) => b.text().includes('Continuar'))!

    expect(continuar.attributes('disabled')).toBeDefined()
  })

  it('avisa enquanto o servidor calcula', () => {
    const frete = montarFrete({ carregando: true })

    expect(frete.text()).toContain('Calculando o frete')
    expect(frete.findAll('input')).toHaveLength(0)
  })

  it('mostra a recusa do destino e oferece repetir', async () => {
    const erro = new ErroDaApi('validacao', 'Confira os campos destacados.', 400, {
      endereco: 'Não há entrega para esse estado.',
    })

    const frete = montarFrete({ erro })

    expect(frete.text()).toContain('Não há entrega para esse estado.')
  })

  it('pede nova cotação quando dá para repetir', async () => {
    const erro = new ErroDaApi('rede', 'Sem resposta da loja.', null, {})

    const frete = montarFrete({ erro })
    await frete.findAll('button').find((b) => b.text().includes('Tentar de novo'))!.trigger('click')

    expect(frete.emitted('repetir')).toHaveLength(1)
  })
})
