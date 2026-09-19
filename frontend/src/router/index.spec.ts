import { beforeEach, describe, expect, it } from 'vitest'

import { router } from './index'

/**
 * As rotas reais, e não uma cópia para teste.
 *
 * O que importa aqui é o que está publicado: os endereços que o backend monta
 * nos e-mails precisam casar, as rotas de conta e gestão precisam exigir o
 * que devem, e o título da aba precisa acompanhar a navegação.
 */
beforeEach(async () => {
  await router.replace('/')
  await router.isReady()
})

function rota(caminho: string) {
  return router.resolve(caminho)
}

describe('rotas', () => {
  it('casa com os links que o backend manda por e-mail', () => {
    // `painel/emails.py` monta {FRONTEND_URL}/ativar/<uid>/<token>/ e
    // {FRONTEND_URL}/redefinir-senha/<uid>/<token>/ — com barra no fim.
    const ativacao = rota('/ativar/Mg/df49ep-960e7023/')
    expect(ativacao.name).toBe('ativar-conta')
    expect(ativacao.params).toEqual({ uid: 'Mg', token: 'df49ep-960e7023' })

    const redefinicao = rota('/redefinir-senha/Mg/abc-123/')
    expect(redefinicao.name).toBe('redefinir-senha')
    expect(redefinicao.params).toEqual({ uid: 'Mg', token: 'abc-123' })
  })

  it('exige sessão nas rotas de conta, carrinho, checkout e pedidos', () => {
    for (const caminho of [
      '/carrinho',
      '/checkout',
      '/pedidos',
      '/pedidos/PED-1',
      '/conta',
      '/conta/enderecos',
      '/conta/senha',
    ]) {
      expect(rota(caminho).meta.exigeAutenticacao, caminho).toBe(true)
    }
  })

  it('marca a gestão como administrativa e autenticada', () => {
    for (const caminho of [
      '/admin/produtos',
      '/admin/produtos/novo',
      '/admin/produtos/uuid-1',
      '/admin/pedidos',
      '/admin/usuarios',
    ]) {
      expect(rota(caminho).meta.admin, caminho).toBe(true)
      expect(rota(caminho).meta.exigeAutenticacao, caminho).toBe(true)
    }
  })

  it('deixa vitrine, catálogo e produto abertos a visitante', () => {
    for (const caminho of ['/', '/catalogo', '/produto/uuid-1']) {
      expect(rota(caminho).meta.exigeAutenticacao, caminho).toBeUndefined()
      expect(rota(caminho).meta.admin, caminho).toBeUndefined()
    }
  })

  it('fecha login, cadastro e recuperação para quem já entrou', () => {
    for (const caminho of ['/entrar', '/criar-conta', '/recuperar-senha']) {
      expect(rota(caminho).meta.apenasVisitante, caminho).toBe(true)
    }
  })

  it('não exige sessão nos links de e-mail, que chegam deslogado', () => {
    // Quem clica no link de ativação ainda não tem conta funcionando.
    expect(rota('/ativar/Mg/abc').meta.exigeAutenticacao).toBeUndefined()
    expect(rota('/redefinir-senha/Mg/abc').meta.exigeAutenticacao).toBeUndefined()
  })

  it('manda qualquer endereço desconhecido para a página de não encontrado', () => {
    expect(rota('/nao-existe').name).toBe('nao-encontrado')
    expect(rota('/um/caminho/qualquer').name).toBe('nao-encontrado')
  })

  it('ajusta o título da aba na navegação', async () => {
    await router.push('/catalogo')
    expect(document.title).toContain('Catálogo')

    await router.push('/carrinho')
    expect(document.title).toContain('Carrinho')
  })

  it('carrega o componente de toda rota declarada', async () => {
    // Os `import()` são tardios: um caminho errado só quebraria quando
    // alguém navegasse até lá. Aqui todos são resolvidos de uma vez.
    const carregadores = router
      .getRoutes()
      .map((declarada) => declarada.components?.default)
      .filter((componente): componente is () => Promise<unknown> => typeof componente === 'function')

    expect(carregadores.length).toBeGreaterThan(10)

    for (const carregar of carregadores) {
      await expect(carregar()).resolves.toBeTruthy()
    }
  })

  it('volta ao topo ao trocar de página', async () => {
    await router.push('/catalogo')
    const comportamento = router.options.scrollBehavior!
    // A rota corrente já vem no formato que o `scrollBehavior` recebe.
    const atual = router.currentRoute.value

    expect(comportamento(atual, atual, null)).toEqual({ top: 0 })
    // Voltar pelo histórico recupera onde a pessoa estava.
    expect(comportamento(atual, atual, { left: 0, top: 220 })).toEqual({ left: 0, top: 220 })
  })
})
