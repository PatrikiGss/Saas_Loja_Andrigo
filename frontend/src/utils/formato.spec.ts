import { describe, expect, it } from 'vitest'

import { apenasDigitos, cep, data, dataHora, moeda, numero, somarDinheiro } from './formato'

describe('moeda', () => {
  it('formata o texto decimal que o DRF manda', () => {
    // O backend serializa DecimalField como texto para não perder precisão.
    const formatado = moeda('49.90')

    expect(formatado).toContain('49')
    expect(formatado).toContain('90')
  })

  it('mostra traço quando não há valor, em vez de zero ou NaN', () => {
    expect(moeda(null)).toBe('—')
    expect(moeda(undefined)).toBe('—')
    expect(moeda('')).toBe('—')
    expect(moeda('abacaxi')).toBe('—')
  })

  it('não confunde zero com ausência', () => {
    expect(moeda('0.00')).not.toBe('—')
  })
})

describe('numero', () => {
  it('formata inteiro e decimal', () => {
    expect(numero(600)).toBe('600')
    expect(numero('3.5')).toContain('3')
  })

  it('mostra traço quando não há valor', () => {
    expect(numero(null)).toBe('—')
    expect(numero('')).toBe('—')
  })
})

describe('somarDinheiro', () => {
  it('soma em centavos, sem o erro do ponto flutuante', () => {
    // 49.90 + 24.90 em ponto flutuante dá 74.80000000000001.
    expect(somarDinheiro('49.90', '24.90')).toBe('74.80')
    expect(somarDinheiro('0.1', '0.2')).toBe('0.30')
  })

  it('sempre devolve duas casas', () => {
    expect(somarDinheiro('10', '5')).toBe('15.00')
  })

  it('trata ausência como zero, para uma linha faltando não apagar o total', () => {
    expect(somarDinheiro('19.90', null)).toBe('19.90')
    expect(somarDinheiro(null, undefined)).toBe('0.00')
  })
})

describe('cep', () => {
  it('separa para leitura', () => {
    expect(cep('01001000')).toBe('01001-000')
  })

  it('devolve o que veio quando não são oito dígitos', () => {
    expect(cep('123')).toBe('123')
    expect(cep('')).toBe('')
    expect(cep(null)).toBe('')
  })
})

describe('data e dataHora', () => {
  it('formata o ISO 8601 que o DRF manda', () => {
    const formatada = data('2026-09-19T00:09:00Z')

    expect(formatada).toContain('2026')
    expect(formatada).not.toBe('—')
  })

  it('inclui a hora quando pedida', () => {
    const comHora = dataHora('2026-09-19T00:09:00Z')

    expect(comHora.length).toBeGreaterThan(data('2026-09-19T00:09:00Z').length)
  })

  it('mostra traço quando não há data', () => {
    // `pago_em` vem nulo enquanto o pedido não foi pago.
    expect(dataHora(null)).toBe('—')
    expect(dataHora('')).toBe('—')
    expect(dataHora('não é data')).toBe('—')
  })
})

describe('apenasDigitos', () => {
  it('tira a pontuação que o backend recusa', () => {
    expect(apenasDigitos('01001-000')).toBe('01001000')
    expect(apenasDigitos(' 01001 000 ')).toBe('01001000')
  })
})
