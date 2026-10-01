import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import InicioView from './InicioView.vue'
import * as servico from '../services/catalogo'
import { falhaSemResposta } from '../../../testes/falhas'
import { umSubtipo } from '../../../testes/fixtures'
import { montarNaRota, roteadorDeTeste } from '../../../testes/roteador'

vi.mock('../services/catalogo')

const ROTAS = {
  inicio: '/',
  catalogo: '/catalogo',
}

async function montar() {
  return (await montarNaRota(InicioView, '/', ROTAS)).tela
}

beforeEach(() => {
  vi.mocked(servico.listarSubtipos)
    .mockReset()
    .mockResolvedValue([
      umSubtipo('essencia-nic-salt', 'essencia', 'Nic salt'),
      umSubtipo('essencia-freebase', 'essencia', 'Freebase'),
      umSubtipo('descartavel-box', 'pod_descartavel', 'Box'),
    ])
})

describe('InicioView', () => {
  it('abre com a parede de cor das categorias', async () => {
    const tela = await montar()

    // Duas categorias, agrupadas a partir dos três subtipos.
    expect(tela.findAll('.familia')).toHaveLength(2)
    expect(tela.text()).toContain('Essência')
    expect(tela.text()).toContain('Pod descartável')
  })

  it('pinta cada família com o matiz da categoria', async () => {
    const tela = await montar()
    const cores = tela.findAll('.familia__cor').map((c) => c.attributes('style') ?? '')

    expect(cores[0]).toContain('var(--cat-essencia)')
    expect(cores[1]).toContain('var(--cat-pod-descartavel)')
  })

  it('leva ao catálogo filtrado pela categoria e pelo subtipo', async () => {
    const tela = await montar()
    const enderecos = tela.findAll('a').map((a) => a.attributes('href'))

    expect(enderecos).toContain('/catalogo?categoria=essencia')
    expect(enderecos).toContain('/catalogo?categoria=essencia&subtipo=essencia-nic-salt')
  })

  it('avisa enquanto carrega', async () => {
    // A busca nunca resolve: a tela fica no estado de espera.
    vi.mocked(servico.listarSubtipos).mockReturnValue(new Promise(() => {}))
    const router = roteadorDeTeste(ROTAS)
    const tela = mount(InicioView, { global: { plugins: [router] } })

    // O `carregando` é marcado no `onMounted`, mas o redesenho é agendado.
    await tela.vm.$nextTick()

    expect(tela.text()).toContain('Carregando')
  })

  it('oferece tentar de novo quando a loja não responde', async () => {
    vi.mocked(servico.listarSubtipos).mockRejectedValue(falhaSemResposta())

    const tela = await montar()

    expect(tela.text()).toContain('Sem resposta da loja')
    expect(tela.findAll('button').some((b) => b.text().includes('Tentar de novo'))).toBe(true)
  })

  it('refaz a busca ao tentar de novo', async () => {
    vi.mocked(servico.listarSubtipos).mockRejectedValueOnce(falhaSemResposta())
    const tela = await montar()

    await tela
      .findAll('button')
      .find((b) => b.text().includes('Tentar de novo'))!
      .trigger('click')
    await flushPromises()

    expect(tela.findAll('.familia')).toHaveLength(2)
  })

  it('convida a esperar quando o catálogo ainda não tem subtipo', async () => {
    vi.mocked(servico.listarSubtipos).mockResolvedValue([])

    const tela = await montar()

    expect(tela.text()).toContain('catálogo ainda está vazio')
  })
})
