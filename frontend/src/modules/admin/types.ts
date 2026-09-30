/** Formas que a API expõe apenas para contas administrativas. */
import type { Esquema } from '@/types/api'

/**
 * Produto como a equipe da loja o enxerga.
 *
 * O `ProdutoGestaoSerializer` acrescenta estoque, situação e datas aos campos
 * públicos. `estoque` é somente leitura aqui: ele muda pelo endpoint de
 * ajuste, que faz a conta no banco em uma consulta atômica.
 */
export type ProdutoGestao = Esquema<'ProdutoGestao'>

/** Campos que o cadastro de produto envia. */
export type DadosDeProduto = Esquema<'ProdutoGestaoRequest'>

/** Resposta de `/api/usuarios/`. Só `ativo` é editável por ali. */
export type UsuarioAdmin = Esquema<'UsuarioAdmin'>
