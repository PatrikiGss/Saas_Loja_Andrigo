import { describe, expect, it } from 'vitest'

import { comoCredenciaisRecusadas, deErro, ErroDaApi } from './erros'
import { falhaComResposta, falhaSemResposta } from '../testes/falhas'

describe('deErro', () => {
  it('classifica os status que a API usa', () => {
    expect(deErro(falhaComResposta(400, {})).tipo).toBe('validacao')
    expect(deErro(falhaComResposta(401, {})).tipo).toBe('nao_autenticado')
    expect(deErro(falhaComResposta(403, {})).tipo).toBe('sem_permissao')
    expect(deErro(falhaComResposta(404, {})).tipo).toBe('nao_encontrado')
    expect(deErro(falhaComResposta(409, {})).tipo).toBe('conflito')
    expect(deErro(falhaComResposta(429, {})).tipo).toBe('limite_excedido')
    expect(deErro(falhaComResposta(503, {})).tipo).toBe('indisponivel')
    expect(deErro(falhaComResposta(500, {})).tipo).toBe('servidor')
  })

  it('separa falha de rede de tempo esgotado', () => {
    expect(deErro(falhaSemResposta()).tipo).toBe('rede')
    expect(deErro(falhaSemResposta('ECONNABORTED')).tipo).toBe('tempo_esgotado')
  })

  it('aproveita a mensagem de domínio do backend em 400', () => {
    const erro = deErro(falhaComResposta(400, { carrinho: ['Carrinho vazio.'] }))

    expect(erro.campos).toEqual({ carrinho: 'Carrinho vazio.' })
    expect(erro.tipo).toBe('validacao')
  })

  it('usa detail e non_field_errors como mensagem geral, não como campo', () => {
    const comDetail = deErro(
      falhaComResposta(409, { detail: 'Produto em uso por outros registros.' }),
    )
    expect(comDetail.message).toBe('Produto em uso por outros registros.')
    expect(comDetail.campos).toEqual({})

    const comNonField = deErro(falhaComResposta(400, { non_field_errors: ['Link inválido.'] }))
    expect(comNonField.message).toBe('Link inválido.')
    expect(comNonField.campos).toEqual({})
  })

  it('achata a lista de mensagens que o DRF devolve por campo', () => {
    const erro = deErro(
      falhaComResposta(400, { password: ['Senha curta demais.', 'Senha comum demais.'] }),
    )

    expect(erro.campos.password).toBe('Senha curta demais. Senha comum demais.')
  })

  it('achata erro de serializer aninhado', () => {
    const erro = deErro(falhaComResposta(400, { endereco: { cep: ['Informe 8 dígitos.'] } }))

    expect(erro.campos.endereco).toBe('Informe 8 dígitos.')
  })

  it('não deixa corpo de 500 chegar à tela', () => {
    const erro = deErro(falhaComResposta(500, '<html>Traceback (most recent call last)...</html>'))

    expect(erro.message).not.toContain('Traceback')
    expect(erro.message).toBe('A loja não conseguiu responder. Tente de novo em instantes.')
  })

  it('não mostra o 404 do Django, que está em inglês e cita o model', () => {
    // 'No Pedido matches the given query.' é o texto do get_object_or_404.
    const erro = deErro(falhaComResposta(404, { detail: 'No Pedido matches the given query.' }))

    expect(erro.message).toBe('Não encontramos o que você procura.')
    expect(erro.message).not.toContain('Pedido')
  })

  it('não mostra o 403 padrão do DRF, que também vem em inglês', () => {
    const erro = deErro(
      falhaComResposta(403, { detail: 'You do not have permission to perform this action.' }),
    )

    expect(erro.message).toBe('Esta conta não tem acesso a isso.')
  })

  it('guarda o detail cru para quem souber de onde ele veio', () => {
    // Alguns endpoints recusam com texto próprio fora dos status confiáveis;
    // a informação fica guardada, mas não vai sozinha para a tela.
    const erro = deErro(falhaComResposta(403, { detail: 'Conta protegida.' }))

    expect(erro.detalheDoServidor).toBe('Conta protegida.')
    expect(erro.message).not.toBe('Conta protegida.')
  })

  it('ignora o texto de throttle do DRF, que fala do sistema e não da pessoa', () => {
    const erro = deErro(
      falhaComResposta(429, { detail: 'Request was throttled. Expected available in 59 seconds.' }),
    )

    expect(erro.message).not.toContain('throttled')
  })

  it('não repassa corpo que não é JSON como mensagem', () => {
    const erro = deErro(falhaComResposta(400, '<html>erro</html>'))

    expect(erro.message).toBe('Confira os campos destacados.')
  })

  it('só oferece repetir quando repetir pode mudar o resultado', () => {
    expect(deErro(falhaSemResposta()).vaiAdiantarTentarDeNovo).toBe(true)
    expect(deErro(falhaComResposta(500, {})).vaiAdiantarTentarDeNovo).toBe(true)
    expect(deErro(falhaComResposta(403, {})).vaiAdiantarTentarDeNovo).toBe(false)
    expect(deErro(falhaComResposta(404, {})).vaiAdiantarTentarDeNovo).toBe(false)
  })

  it('devolve o mesmo erro quando já é ErroDaApi', () => {
    const original = new ErroDaApi('conflito', 'x', 409, {})

    expect(deErro(original)).toBe(original)
  })

  it('trata falha que não veio do axios', () => {
    expect(deErro(new TypeError('boom')).tipo).toBe('desconhecido')
  })

  it('classifica como desconhecido o status que a API não usa', () => {
    const erro = deErro(falhaComResposta(418, {}))

    expect(erro.tipo).toBe('desconhecido')
    expect(erro.status).toBe(418)
  })

  it('lê corpo vazio ou em lista sem quebrar, com a mensagem padrão', () => {
    // Lista crua é o que o DRF devolve para `ValidationError('texto')` levantado
    // direto na view, sem campo.
    for (const corpo of [null, ['Algo deu errado.']]) {
      const erro = deErro(falhaComResposta(400, corpo))

      expect(erro.message).toBe('Confira os campos destacados.')
      expect(erro.campos).toEqual({})
    }
  })

  it('não transforma mensagem em branco em erro de campo', () => {
    const erro = deErro(falhaComResposta(400, { nome: ['   '], email: [], cep: 'CEP inválido.' }))

    expect(erro.campos).toEqual({ cep: 'CEP inválido.' })
  })
})

describe('comoCredenciaisRecusadas', () => {
  it('troca sessão expirada por credencial recusada', () => {
    // Na tela de entrar, mandar a pessoa 'entrar de novo' não diz nada.
    const erro = comoCredenciaisRecusadas(
      falhaComResposta(401, { detail: 'No active account found with the given credentials' }),
    )

    expect(erro.tipo).toBe('credenciais')
    expect(erro.message).toContain('E-mail ou senha incorretos')
    expect(erro.message).not.toContain('No active account')
  })

  it('não oferece repetir: insistir com a mesma senha dá no mesmo', () => {
    expect(comoCredenciaisRecusadas(falhaComResposta(401, {})).vaiAdiantarTentarDeNovo).toBe(false)
  })

  it('deixa os outros erros como estão', () => {
    expect(comoCredenciaisRecusadas(falhaComResposta(429, {})).tipo).toBe('limite_excedido')
    expect(comoCredenciaisRecusadas(falhaSemResposta()).tipo).toBe('rede')
    expect(comoCredenciaisRecusadas(falhaComResposta(400, { email: ['Inválido.'] })).tipo).toBe(
      'validacao',
    )
  })
})
