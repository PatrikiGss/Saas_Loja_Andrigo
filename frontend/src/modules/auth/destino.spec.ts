import { describe, expect, it } from 'vitest'

import { destinoSeguro } from './destino'

describe('destinoSeguro', () => {
  it('aceita caminho interno', () => {
    expect(destinoSeguro('/pedidos')).toBe('/pedidos')
    expect(destinoSeguro('/conta/senha?aba=1')).toBe('/conta/senha?aba=1')
  })

  it('recusa endereço de outro servidor', () => {
    // O valor vem da barra de endereço, então é entrada de fora.
    expect(destinoSeguro('https://exemplo-hostil.test')).toBe('/')
    expect(destinoSeguro('//exemplo-hostil.test')).toBe('/')
    expect(destinoSeguro('javascript:alert(1)')).toBe('/')
  })

  it('recusa o que não é texto e o que veio vazio', () => {
    expect(destinoSeguro(undefined)).toBe('/')
    expect(destinoSeguro(['/a', '/b'])).toBe('/')
    expect(destinoSeguro('')).toBe('/')
  })
})
