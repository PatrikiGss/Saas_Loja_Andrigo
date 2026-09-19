import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'

import { comoCredenciaisRecusadas, deErro, ErroDaApi } from './erros'

function respostaDe(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const resposta = { status, data, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('falhou', String(status), config, {}, resposta)
}

function semResposta(code?: string): AxiosError {
  return new AxiosError('falhou', code, { headers: new AxiosHeaders() }, {})
}

describe('deErro', () => {
  it('classifica os status que a API usa', () => {
    expect(deErro(respostaDe(400, {})).tipo).toBe('validacao')
    expect(deErro(respostaDe(401, {})).tipo).toBe('nao_autenticado')
    expect(deErro(respostaDe(403, {})).tipo).toBe('sem_permissao')
    expect(deErro(respostaDe(404, {})).tipo).toBe('nao_encontrado')
    expect(deErro(respostaDe(409, {})).tipo).toBe('conflito')
    expect(deErro(respostaDe(429, {})).tipo).toBe('limite_excedido')
    expect(deErro(respostaDe(503, {})).tipo).toBe('indisponivel')
    expect(deErro(respostaDe(500, {})).tipo).toBe('servidor')
  })

  it('separa falha de rede de tempo esgotado', () => {
    expect(deErro(semResposta()).tipo).toBe('rede')
    expect(deErro(semResposta('ECONNABORTED')).tipo).toBe('tempo_esgotado')
  })

  it('aproveita a mensagem de domínio do backend em 400', () => {
    const erro = deErro(respostaDe(400, { carrinho: ['Carrinho vazio.'] }))

    expect(erro.campos).toEqual({ carrinho: 'Carrinho vazio.' })
    expect(erro.tipo).toBe('validacao')
  })

  it('usa detail e non_field_errors como mensagem geral, não como campo', () => {
    const comDetail = deErro(respostaDe(409, { detail: 'Produto em uso por outros registros.' }))
    expect(comDetail.message).toBe('Produto em uso por outros registros.')
    expect(comDetail.campos).toEqual({})

    const comNonField = deErro(respostaDe(400, { non_field_errors: ['Link inválido.'] }))
    expect(comNonField.message).toBe('Link inválido.')
    expect(comNonField.campos).toEqual({})
  })

  it('achata a lista de mensagens que o DRF devolve por campo', () => {
    const erro = deErro(
      respostaDe(400, { password: ['Senha curta demais.', 'Senha comum demais.'] }),
    )

    expect(erro.campos.password).toBe('Senha curta demais. Senha comum demais.')
  })

  it('achata erro de serializer aninhado', () => {
    const erro = deErro(respostaDe(400, { endereco: { cep: ['Informe 8 dígitos.'] } }))

    expect(erro.campos.endereco).toBe('Informe 8 dígitos.')
  })

  it('não deixa corpo de 500 chegar à tela', () => {
    const erro = deErro(respostaDe(500, '<html>Traceback (most recent call last)...</html>'))

    expect(erro.message).not.toContain('Traceback')
    expect(erro.message).toBe('A loja não conseguiu responder. Tente de novo em instantes.')
  })

  it('não mostra o 404 do Django, que está em inglês e cita o model', () => {
    // 'No Pedido matches the given query.' é o texto do get_object_or_404.
    const erro = deErro(respostaDe(404, { detail: 'No Pedido matches the given query.' }))

    expect(erro.message).toBe('Não encontramos o que você procura.')
    expect(erro.message).not.toContain('Pedido')
  })

  it('não mostra o 403 padrão do DRF, que também vem em inglês', () => {
    const erro = deErro(
      respostaDe(403, { detail: 'You do not have permission to perform this action.' }),
    )

    expect(erro.message).toBe('Esta conta não tem acesso a isso.')
  })

  it('guarda o detail cru para quem souber de onde ele veio', () => {
    // Alguns endpoints recusam com texto próprio fora dos status confiáveis;
    // a informação fica guardada, mas não vai sozinha para a tela.
    const erro = deErro(respostaDe(403, { detail: 'Conta protegida.' }))

    expect(erro.detalheDoServidor).toBe('Conta protegida.')
    expect(erro.message).not.toBe('Conta protegida.')
  })

  it('ignora o texto de throttle do DRF, que fala do sistema e não da pessoa', () => {
    const erro = deErro(
      respostaDe(429, { detail: 'Request was throttled. Expected available in 59 seconds.' }),
    )

    expect(erro.message).not.toContain('throttled')
  })

  it('não repassa corpo que não é JSON como mensagem', () => {
    const erro = deErro(respostaDe(400, '<html>erro</html>'))

    expect(erro.message).toBe('Confira os campos destacados.')
  })

  it('só oferece repetir quando repetir pode mudar o resultado', () => {
    expect(deErro(semResposta()).vaiAdiantarTentarDeNovo).toBe(true)
    expect(deErro(respostaDe(500, {})).vaiAdiantarTentarDeNovo).toBe(true)
    expect(deErro(respostaDe(403, {})).vaiAdiantarTentarDeNovo).toBe(false)
    expect(deErro(respostaDe(404, {})).vaiAdiantarTentarDeNovo).toBe(false)
  })

  it('devolve o mesmo erro quando já é ErroDaApi', () => {
    const original = new ErroDaApi('conflito', 'x', 409, {})

    expect(deErro(original)).toBe(original)
  })

  it('trata falha que não veio do axios', () => {
    expect(deErro(new TypeError('boom')).tipo).toBe('desconhecido')
  })
})

describe('comoCredenciaisRecusadas', () => {
  it('troca sessão expirada por credencial recusada', () => {
    // Na tela de entrar, mandar a pessoa 'entrar de novo' não diz nada.
    const erro = comoCredenciaisRecusadas(
      respostaDe(401, { detail: 'No active account found with the given credentials' }),
    )

    expect(erro.tipo).toBe('credenciais')
    expect(erro.message).toContain('E-mail ou senha incorretos')
    expect(erro.message).not.toContain('No active account')
  })

  it('não oferece repetir: insistir com a mesma senha dá no mesmo', () => {
    expect(comoCredenciaisRecusadas(respostaDe(401, {})).vaiAdiantarTentarDeNovo).toBe(false)
  })

  it('deixa os outros erros como estão', () => {
    expect(comoCredenciaisRecusadas(respostaDe(429, {})).tipo).toBe('limite_excedido')
    expect(comoCredenciaisRecusadas(semResposta()).tipo).toBe('rede')
    expect(comoCredenciaisRecusadas(respostaDe(400, { email: ['Inválido.'] })).tipo).toBe(
      'validacao',
    )
  })
})
