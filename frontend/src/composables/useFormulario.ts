/**
 * Envio de formulário: estado, erro por campo e trava de duplo envio.
 *
 * Existe para que nenhum formulário reescreva o mesmo `try/catch` nem esqueça
 * de bloquear o segundo clique — que, num checkout, sai caro.
 */
import { ref, type Ref } from 'vue'

import { deErro, type CamposComErro, type ErroDaApi } from '@/services/erros'

export interface Formulario<T> {
  enviando: Ref<boolean>
  /** Erro geral, para a faixa de aviso do formulário. */
  erro: Ref<ErroDaApi | null>
  /** Erro por campo, como o DRF devolveu, para encostar em cada entrada. */
  campos: Ref<CamposComErro>
  /** Envia e devolve o resultado, ou nada se falhou. */
  submeter: () => Promise<T | null>
  limpar: () => void
}

export function useFormulario<T>(enviar: () => Promise<T>): Formulario<T> {
  const enviando = ref(false)
  const erro = ref<ErroDaApi | null>(null)
  const campos = ref<CamposComErro>({})

  function limpar(): void {
    erro.value = null
    campos.value = {}
  }

  async function submeter(): Promise<T | null> {
    // Segunda trava contra o duplo envio: o botão já se desabilita sozinho,
    // mas Enter no campo e clique podem chegar quase juntos.
    if (enviando.value) {
      return null
    }

    enviando.value = true
    limpar()

    try {
      return await enviar()
    } catch (falha) {
      const problema = deErro(falha)
      erro.value = problema
      campos.value = problema.campos
      return null
    } finally {
      enviando.value = false
    }
  }

  return { enviando, erro, campos, submeter, limpar }
}
