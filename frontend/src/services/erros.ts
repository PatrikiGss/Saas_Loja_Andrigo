/**
 * Tradução de falha de rede ou de resposta da API para um erro único.
 *
 * O resto da aplicação nunca olha `status`, `response.data` ou o formato do
 * DRF: olha `tipo`, `mensagem` e `campos`. Assim a decisão sobre o que o
 * usuário lê é tomada em um lugar só, e detalhe interno não vaza para a tela.
 */
import axios, { type AxiosError } from 'axios'

export type TipoDeErro =
  | 'validacao'
  | 'credenciais'
  | 'nao_autenticado'
  | 'sem_permissao'
  | 'nao_encontrado'
  | 'conflito'
  | 'limite_excedido'
  | 'indisponivel'
  | 'servidor'
  | 'rede'
  | 'tempo_esgotado'
  | 'desconhecido'

/**
 * O que a pessoa lê quando não há mensagem do backend para aproveitar.
 *
 * Texto diz o que houve e o que fazer a seguir. Não pede desculpa e não
 * descreve o sistema por dentro.
 */
const MENSAGEM_PADRAO: Record<TipoDeErro, string> = {
  validacao: 'Confira os campos destacados.',
  // O backend responde igual para senha errada, e-mail inexistente e conta
  // não confirmada, de propósito. Citar as três possibilidades ajuda quem
  // esqueceu de confirmar e não revela qual delas aconteceu.
  credenciais:
    'E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail antes de entrar.',
  nao_autenticado: 'Sua sessão expirou. Entre de novo para continuar.',
  sem_permissao: 'Esta conta não tem acesso a isso.',
  nao_encontrado: 'Não encontramos o que você procura.',
  conflito: 'Isso mudou desde que a página carregou. Recarregue e tente de novo.',
  limite_excedido: 'Tentativas demais em pouco tempo. Espere um minuto e tente de novo.',
  indisponivel: 'Serviço fora do ar no momento. Tente de novo em instantes.',
  servidor: 'A loja não conseguiu responder. Tente de novo em instantes.',
  rede: 'Sem resposta da loja. Verifique a conexão e tente de novo.',
  tempo_esgotado: 'A resposta demorou demais. Tente de novo.',
  desconhecido: 'Algo saiu do esperado. Tente de novo.',
}

const TIPO_POR_STATUS: Record<number, TipoDeErro> = {
  400: 'validacao',
  401: 'nao_autenticado',
  403: 'sem_permissao',
  404: 'nao_encontrado',
  405: 'desconhecido',
  409: 'conflito',
  422: 'validacao',
  429: 'limite_excedido',
  503: 'indisponivel',
}

/**
 * Status em que a mensagem do backend pode ir direto para a tela.
 *
 * Só estes três, e a lista é fechada de propósito. Em 400, 409 e 422 o texto
 * nasce nos nossos serializers e no `clean()` dos models — 'Carrinho vazio.',
 * 'Quantidade acima do estoque disponível.' — e ajuda de verdade.
 *
 * Fora daí quem escreve é o framework, em inglês e falando de dentro: um 404
 * do DRF responde 'No Pedido matches the given query.', que além de não estar
 * no idioma da loja entrega o nome do model. De 500 para cima é pior ainda,
 * porque com DEBUG ligado o Django responde HTML de traceback.
 */
const STATUS_COM_MENSAGEM_DO_DOMINIO = new Set([400, 409, 422])

function podeAproveitarMensagem(status: number): boolean {
  return STATUS_COM_MENSAGEM_DO_DOMINIO.has(status)
}

/** Erros de um campo de formulário, já achatados para uma frase por campo. */
export type CamposComErro = Record<string, string>

export class ErroDaApi extends Error {
  readonly tipo: TipoDeErro
  /** Status HTTP, quando houve resposta. */
  readonly status: number | null
  /** Erro por campo, vindo do DRF. Vazio quando a falha não é de validação. */
  readonly campos: CamposComErro
  /**
   * O `detail` cru da resposta, sem filtro.
   *
   * Existe para o punhado de endpoints em que o backend recusa com texto
   * próprio fora dos status confiáveis — `PermissionDenied('Conta
   * protegida.')`, por exemplo. **Não mostre isto sem saber de onde veio:**
   * no caso geral é o texto em inglês do framework.
   */
  readonly detalheDoServidor: string | null

  constructor(
    tipo: TipoDeErro,
    mensagem: string,
    status: number | null,
    campos: CamposComErro,
    detalheDoServidor: string | null = null,
  ) {
    super(mensagem)
    this.name = 'ErroDaApi'
    this.tipo = tipo
    this.status = status
    this.campos = campos
    this.detalheDoServidor = detalheDoServidor
  }

  /** Vale a pena oferecer 'tentar de novo'? Reenviar 403 ou 404 não muda nada. */
  get vaiAdiantarTentarDeNovo(): boolean {
    return (
      this.tipo === 'rede' ||
      this.tipo === 'tempo_esgotado' ||
      this.tipo === 'servidor' ||
      this.tipo === 'indisponivel' ||
      this.tipo === 'limite_excedido'
    )
  }
}

/**
 * Reescreve o 401 do login.
 *
 * Em qualquer outra rota, 401 quer dizer sessão vencida. No login quer dizer
 * que aquele par de e-mail e senha não abre conta nenhuma — e mandar a pessoa
 * 'entrar de novo' na tela de entrar não faz sentido. O endpoint é quem sabe
 * disso, então a tradução mora no serviço de autenticação, não aqui no meio.
 */
export function comoCredenciaisRecusadas(falha: unknown): ErroDaApi {
  const erro = deErro(falha)
  if (erro.tipo !== 'nao_autenticado') {
    return erro
  }
  return new ErroDaApi('credenciais', MENSAGEM_PADRAO.credenciais, erro.status, erro.campos)
}

/** Converte qualquer falha lançada por uma requisição em `ErroDaApi`. */
export function deErro(falha: unknown): ErroDaApi {
  if (falha instanceof ErroDaApi) {
    return falha
  }

  if (!axios.isAxiosError(falha)) {
    return new ErroDaApi('desconhecido', MENSAGEM_PADRAO.desconhecido, null, {})
  }

  const erro = falha as AxiosError
  if (!erro.response) {
    const tipo: TipoDeErro = erro.code === 'ECONNABORTED' ? 'tempo_esgotado' : 'rede'
    return new ErroDaApi(tipo, MENSAGEM_PADRAO[tipo], null, {})
  }

  const status = erro.response.status
  const tipo = TIPO_POR_STATUS[status] ?? (status >= 500 ? 'servidor' : 'desconhecido')
  const corpo = erro.response.data

  const confiavel = podeAproveitarMensagem(status)
  const campos = confiavel ? camposDe(corpo) : {}
  const mensagem = confiavel
    ? (mensagemGeralDe(corpo) ?? MENSAGEM_PADRAO[tipo])
    : MENSAGEM_PADRAO[tipo]

  return new ErroDaApi(tipo, mensagem, status, campos, mensagemGeralDe(corpo))
}

/** Chaves que o DRF usa para o erro que não pertence a nenhum campo. */
const CHAVES_GERAIS = ['detail', 'non_field_errors']

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Achata o valor de uma chave do DRF em uma frase.
 *
 * O DRF devolve lista de strings por campo, e às vezes objeto aninhado quando
 * o serializer tem serializer dentro. Nos dois casos o que a tela precisa é
 * uma linha de texto.
 */
function frase(valor: unknown): string | null {
  if (typeof valor === 'string') {
    return valor.trim() || null
  }
  if (Array.isArray(valor)) {
    const partes = valor.map(frase).filter((parte): parte is string => parte !== null)
    return partes.length ? partes.join(' ') : null
  }
  if (ehObjeto(valor)) {
    return frase(Object.values(valor))
  }
  return null
}

function mensagemGeralDe(corpo: unknown): string | null {
  if (typeof corpo === 'string') {
    // Resposta que não é JSON (uma página de erro, por exemplo) não vira texto
    // de interface: seria despejar HTML na tela.
    return null
  }
  if (!ehObjeto(corpo)) {
    return null
  }
  for (const chave of CHAVES_GERAIS) {
    const texto = frase(corpo[chave])
    if (texto) {
      return texto
    }
  }
  return null
}

function camposDe(corpo: unknown): CamposComErro {
  if (!ehObjeto(corpo)) {
    return {}
  }

  const campos: CamposComErro = {}
  for (const [chave, valor] of Object.entries(corpo)) {
    if (CHAVES_GERAIS.includes(chave)) {
      continue
    }
    const texto = frase(valor)
    if (texto) {
      campos[chave] = texto
    }
  }
  return campos
}
