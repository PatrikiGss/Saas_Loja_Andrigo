import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TabelaDados, { type Coluna } from './TabelaDados.vue'

interface Linha {
  id: number
  nome: string
  valor: string
}

const COLUNAS: Coluna[] = [
  { chave: 'nome', titulo: 'Nome' },
  { chave: 'valor', titulo: 'Valor', aoFim: true },
  { chave: 'acoes' },
]

const ITENS: Linha[] = [
  { id: 1, nome: 'Primeiro', valor: '10,00' },
  { id: 2, nome: 'Segundo', valor: '20,00' },
]

function montar() {
  return mount(TabelaDados<Linha>, {
    props: {
      colunas: COLUNAS,
      itens: ITENS,
      chaveDe: (item: Linha) => item.id,
      descricao: 'Coisas cadastradas',
    },
    slots: {
      nome: '<span class="celula-nome">{{ params.item.nome }}</span>',
      valor: '<span>{{ params.item.valor }}</span>',
      acoes: '<button>Remover</button>',
    },
  })
}

describe('TabelaDados', () => {
  it('desenha um cabeçalho por coluna e uma linha por item', () => {
    const tabela = montar()

    expect(tabela.findAll('th')).toHaveLength(3)
    expect(tabela.findAll('tbody tr')).toHaveLength(2)
  })

  it('desenha cada célula pelo slot da coluna', () => {
    const tabela = montar()

    expect(tabela.findAll('.celula-nome').map((c) => c.text())).toEqual(['Primeiro', 'Segundo'])
    expect(tabela.findAll('button')).toHaveLength(2)
  })

  it('dá título de ações ao leitor de tela na coluna sem cabeçalho', () => {
    // Um `<th>` vazio deixa a coluna sem nome para quem navega por leitor.
    const tabela = montar()
    const ultimo = tabela.findAll('th').at(-1)!

    expect(ultimo.get('.apenas-leitor').text()).toBe('Ações')
  })

  it('descreve a tabela para quem não a enxerga', () => {
    const tabela = montar()

    expect(tabela.get('caption').text()).toBe('Coisas cadastradas')
    expect(tabela.get('caption').classes()).toContain('apenas-leitor')
  })

  it('alinha ao fim a coluna marcada', () => {
    const tabela = montar()
    const celulas = tabela.findAll('tbody tr')[0].findAll('td')

    expect(celulas[1].classes()).toContain('tabela__fim')
    expect(celulas[0].classes()).not.toContain('tabela__fim')
  })

  it('guarda o rótulo em cada célula, para o celular não perder o significado', () => {
    // No celular a tabela vira lista e o cabeçalho some; o rótulo volta pelo
    // `data-rotulo`.
    const tabela = montar()
    const celulas = tabela.findAll('tbody tr')[0].findAll('td')

    expect(celulas[0].attributes('data-rotulo')).toBe('Nome')
    expect(celulas[1].attributes('data-rotulo')).toBe('Valor')
    expect(celulas[2].attributes('data-rotulo')).toBeUndefined()
  })

  it('não desenha linha alguma sem itens', () => {
    const tabela = mount(TabelaDados<Linha>, {
      props: {
        colunas: COLUNAS,
        itens: [],
        chaveDe: (item: Linha) => item.id,
        descricao: 'Vazio',
      },
    })

    expect(tabela.findAll('tbody tr')).toHaveLength(0)
    expect(tabela.findAll('th')).toHaveLength(3)
  })
})
