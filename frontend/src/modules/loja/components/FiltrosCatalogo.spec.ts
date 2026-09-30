import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FiltrosCatalogo from './FiltrosCatalogo.vue'
import type { FiltrosDoCatalogo, Subtipo } from '../types'

const SUBTIPOS: Subtipo[] = [
  {
    slug: 'essencia-nic-salt',
    nome: 'Nic salt',
    categoria: 'essencia',
    categoria_display: 'Essência',
    especificacoes: ['volume_ml', 'nicotina_mg_ml'],
  },
  {
    slug: 'essencia-freebase',
    nome: 'Freebase',
    categoria: 'essencia',
    categoria_display: 'Essência',
    especificacoes: ['volume_ml', 'nicotina_mg_ml'],
  },
  {
    slug: 'descartavel-box',
    nome: 'Box',
    categoria: 'pod_descartavel',
    categoria_display: 'Pod descartável',
    especificacoes: ['puffs', 'nicotina_mg_ml'],
  },
]

function montar(filtros: FiltrosDoCatalogo = {}) {
  return mount(FiltrosCatalogo, { props: { subtipos: SUBTIPOS, filtros } })
}

function ultimaAlteracao(tela: ReturnType<typeof montar>): FiltrosDoCatalogo {
  const eventos = tela.emitted('alterar') as unknown[][]
  return eventos.at(-1)![0] as FiltrosDoCatalogo
}

describe('FiltrosCatalogo', () => {
  it('monta as categorias a partir dos subtipos que a API devolveu', () => {
    const tela = montar()

    // 'Todas' mais as duas categorias distintas.
    expect(tela.findAll('.chip')).toHaveLength(3)
    expect(tela.text()).toContain('Essência')
    expect(tela.text()).toContain('Pod descartável')
  })

  it('só oferece os filtros que o backend aceita', () => {
    // Faixa de preço, marca e disponibilidade não entram: a API não os aceita,
    // e filtro que o servidor ignora é promessa quebrada na tela.
    const tela = montar()
    const rotulos = tela.findAll('.refino__rotulo').map((r) => r.text())

    expect(rotulos).toEqual(['Ordenar por'])
  })

  it('mostra o subtipo só depois de escolher a categoria', async () => {
    expect(montar().findAll('select')).toHaveLength(1)

    const comCategoria = montar({ categoria: 'essencia' })
    const opcoes = comCategoria
      .findAll('select')[0]
      .findAll('option')
      .map((o) => o.text())

    expect(comCategoria.findAll('select')).toHaveLength(2)
    expect(opcoes).toEqual(['Todos', 'Nic salt', 'Freebase'])
  })

  it('zera o subtipo ao trocar de categoria, porque ele era da anterior', async () => {
    const tela = montar({ categoria: 'essencia', subtipo: 'essencia-nic-salt' })

    await tela.findAll('.chip')[2].trigger('click')

    expect(ultimaAlteracao(tela).subtipo).toBeUndefined()
    expect(ultimaAlteracao(tela).categoria).toBe('pod_descartavel')
  })

  it('volta para a primeira página em qualquer mudança de filtro', async () => {
    const tela = montar({ categoria: 'essencia', pagina: 4 })

    await tela.findAll('.chip')[0].trigger('click')

    expect(ultimaAlteracao(tela).pagina).toBe(1)
  })

  it('só busca quando a pessoa envia, e não a cada tecla', async () => {
    // O backend limita chamadas por minuto; buscar a cada tecla queimaria isso.
    const tela = montar()

    await tela.get('input[type="search"]').setValue('menta')
    expect(tela.emitted('alterar')).toBeUndefined()

    await tela.get('form').trigger('submit')
    expect(ultimaAlteracao(tela).busca).toBe('menta')
  })

  it('marca a categoria ativa', () => {
    const tela = montar({ categoria: 'essencia' })
    const ativo = tela.findAll('.chip').filter((c) => c.classes('chip--ativo'))

    expect(ativo).toHaveLength(1)
    expect(ativo[0].text()).toContain('Essência')
    expect(ativo[0].attributes('aria-pressed')).toBe('true')
  })

  it('marca Todas quando não há categoria escolhida', () => {
    const tela = montar()

    expect(tela.findAll('.chip')[0].classes()).toContain('chip--ativo')
  })

  it('oferece limpar só quando há filtro aplicado', async () => {
    expect(montar().text()).not.toContain('Limpar filtros')

    const tela = montar({ categoria: 'essencia', ordem: '-preco' })
    expect(tela.text()).toContain('Limpar filtros')

    await tela
      .findAll('button')
      .find((b) => b.text().includes('Limpar filtros'))!
      .trigger('click')

    // Limpar tira os filtros e preserva a ordenação escolhida.
    const depois = ultimaAlteracao(tela)
    expect(depois.categoria).toBeUndefined()
    expect(depois.busca).toBeUndefined()
    expect(depois.ordem).toBe('-preco')
  })

  it('troca a ordenação', async () => {
    const tela = montar()

    await tela.findAll('select')[0].setValue('-preco')

    expect(ultimaAlteracao(tela).ordem).toBe('-preco')
  })

  it('troca o subtipo e trata Todos como sem filtro', async () => {
    const tela = montar({ categoria: 'essencia' })
    const subtipos = tela.findAll('select')[0]

    await subtipos.setValue('essencia-freebase')
    expect(ultimaAlteracao(tela).subtipo).toBe('essencia-freebase')

    await subtipos.setValue('')
    expect(ultimaAlteracao(tela).subtipo).toBeUndefined()
  })
})
