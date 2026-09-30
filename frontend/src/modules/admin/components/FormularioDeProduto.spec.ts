import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { Subtipo } from '@/modules/loja/types'
import FormularioDeProduto from './FormularioDeProduto.vue'
import type { DadosDeProduto, ProdutoGestao } from '../types'

const SUBTIPOS: Subtipo[] = [
  {
    slug: 'descartavel-box',
    nome: 'Box',
    categoria: 'pod_descartavel',
    categoria_display: 'Pod descartável',
  },
  {
    slug: 'essencia-nic-salt',
    nome: 'Nic salt',
    categoria: 'essencia',
    categoria_display: 'Essência',
  },
]

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

function montar(props: Record<string, unknown> = {}) {
  return mount(FormularioDeProduto, { props: { subtipos: SUBTIPOS, ...props } })
}

function campoDe(tela: ReturnType<typeof montar>, rotulo: string) {
  return tela.findAll('.campo').find((bloco) => bloco.text().startsWith(rotulo))!
}

async function preencher(tela: ReturnType<typeof montar>, rotulo: string, valor: string) {
  await campoDe(tela, rotulo).get('input').setValue(valor)
}

function enviado(tela: ReturnType<typeof montar>): DadosDeProduto {
  return (tela.emitted('enviar') as unknown[][]).at(-1)![0] as DadosDeProduto
}

describe('FormularioDeProduto', () => {
  it('nasce à venda: produto novo é para vender', () => {
    const tela = montar()

    expect((tela.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('começa preenchido ao editar', () => {
    const tela = montar({ valorInicial: PRODUTO })

    expect((campoDe(tela, 'SKU').get('input').element as HTMLInputElement).value).toBe('POD-0001')
    expect((campoDe(tela, 'Puffs').get('input').element as HTMLInputElement).value).toBe('600')
    expect((tela.get('select').element as HTMLSelectElement).value).toBe('descartavel-box')
  })

  it('agrupa os subtipos pela categoria no seletor', () => {
    const tela = montar()
    const opcoes = tela
      .get('select')
      .findAll('option')
      .map((o) => o.text())

    expect(opcoes).toEqual(['Escolha', 'Pod descartável — Box', 'Essência — Nic salt'])
  })

  it('manda o SKU em maiúsculas, como o backend valida', async () => {
    const tela = montar()

    await preencher(tela, 'SKU', ' pod-0002 ')
    await tela.get('form').trigger('submit')

    expect(enviado(tela).sku).toBe('POD-0002')
  })

  it('tira o espaço em volta dos textos', async () => {
    const tela = montar()

    await preencher(tela, 'Nome', '  Pod de uva  ')
    await preencher(tela, 'Marca', '  Elfbar ')
    await tela.get('form').trigger('submit')

    expect(enviado(tela).nome).toBe('Pod de uva')
    expect(enviado(tela).marca).toBe('Elfbar')
  })

  it('manda nulo na especificação em branco, e não texto vazio', async () => {
    // Nulo é o que o backend espera onde a especificação não se aplica.
    const tela = montar()

    await tela.get('form').trigger('submit')

    const dados = enviado(tela)
    expect(dados.puffs).toBeNull()
    expect(dados.volume_ml).toBeNull()
    expect(dados.nicotina_mg_ml).toBeNull()
  })

  it('converte puffs para número e mantém os decimais como texto', async () => {
    // `DecimalField` vai e volta como texto para não perder precisão.
    const tela = montar()

    await preencher(tela, 'Puffs', '5000')
    await preencher(tela, 'Volume', '30.00')
    await preencher(tela, 'Nicotina', '35.0')
    await tela.get('form').trigger('submit')

    const dados = enviado(tela)
    expect(dados.puffs).toBe(5000)
    expect(dados.volume_ml).toBe('30.00')
    expect(dados.nicotina_mg_ml).toBe('35.0')
  })

  it('não oferece campo de estoque: ele só muda pelo ajuste', () => {
    const tela = montar({ valorInicial: PRODUTO })
    const rotulos = tela.findAll('.campo__rotulo').map((r) => r.text())

    expect(rotulos.some((r) => r.includes('Estoque'))).toBe(false)
  })

  it('tira de venda quando a caixa é desmarcada', async () => {
    const tela = montar({ valorInicial: PRODUTO })

    await tela.get('input[type="checkbox"]').setValue(false)
    await tela.get('form').trigger('submit')

    expect(enviado(tela).ativo).toBe(false)
  })

  it('mostra a recusa do backend em cada campo', () => {
    const tela = montar({
      campos: {
        sku: 'Já existe um produto com este SKU.',
        subtipo: 'Faça uma escolha válida.',
        puffs: 'Não se aplica a esta categoria.',
      },
    })

    expect(tela.text()).toContain('Já existe um produto com este SKU.')
    expect(tela.text()).toContain('Faça uma escolha válida.')
    expect(tela.text()).toContain('Não se aplica a esta categoria.')
  })

  it('trava os campos enquanto salva', () => {
    const tela = montar({ enviando: true })

    expect(tela.findAll('input:not([disabled])')).toHaveLength(0)
    expect(tela.get('select').attributes('disabled')).toBeDefined()
    expect(tela.get('textarea').attributes('disabled')).toBeDefined()
  })

  it('usa o texto de botão que a tela pediu', () => {
    const tela = montar({ textoDoBotao: 'Salvar alterações' })

    expect(tela.text()).toContain('Salvar alterações')
  })
})
