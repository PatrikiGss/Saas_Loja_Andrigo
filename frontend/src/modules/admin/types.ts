/** Formas que a API expõe apenas para contas administrativas. */
import type { Nivel } from '@/modules/auth/types'
import type { Produto } from '@/modules/loja/types'

/**
 * Produto como a equipe da loja o enxerga.
 *
 * O `ProdutoGestaoSerializer` acrescenta estoque, situação e datas aos campos
 * públicos. `estoque` é somente leitura aqui: ele muda pelo endpoint de
 * ajuste, que faz a conta no banco em uma consulta atômica.
 */
export interface ProdutoGestao extends Produto {
  estoque: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

/** Campos que o cadastro de produto envia. */
export interface DadosDeProduto {
  sku: string
  nome: string
  descricao: string
  marca: string
  subtipo: string
  preco: string
  ativo: boolean
  puffs: number | null
  volume_ml: string | null
  nicotina_mg_ml: string | null
}

/** Resposta de `/api/usuarios/`. Só `ativo` é editável por ali. */
export interface UsuarioAdmin {
  id: number
  email: string
  nome: string
  sobrenome: string
  telefone: string
  nivel: Nivel
  ativo: boolean
  criado_em: string
}
