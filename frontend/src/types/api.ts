/**
 * Formas da API.
 *
 * Nada aqui é escrito à mão a partir do backend. `esquema.ts` é gerado de
 * `backend/schema.yml` por `npm run gerar-tipos`, e o `schema.yml` é gerado
 * dos serializers. Quando um serializer muda, o `vue-tsc` aponta cada tela que
 * dependia da forma antiga — em vez de ela quebrar em produção.
 */
import type { components, paths } from './esquema'

/** Um componente do esquema: `Esquema<'Pedido'>` é a resposta de pedido. */
export type Esquema<Nome extends keyof components['schemas']> = components['schemas'][Nome]

/** Parâmetros de busca que uma rota `GET` aceita. */
export type Consulta<Rota extends keyof paths> = NonNullable<
  paths[Rota] extends { get: { parameters: { query?: infer Q } } } ? Q : never
>

/**
 * Página do `PageNumberPagination` do DRF.
 *
 * Genérica porque a conferência de página (`paginaDe`) é uma só para todos os
 * recursos. O esquema tem uma por recurso — `PaginatedPedidoList` e afins —,
 * com esta mesma forma.
 */
export interface Paginado<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
