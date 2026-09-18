"""Cotação de frete.

Enquanto não existe contrato com transportadora, a cotação sai de uma tabela
própria por região. O resto do sistema só conhece `cotar` e `cotar_servico`:
trocar por uma API de transportadora é reescrever este arquivo, sem tocar em
view, serializer ou model.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.db import models

CENTAVOS = Decimal('0.01')


class ServicoFrete(models.TextChoices):
    ECONOMICO = 'economico', 'Econômico'
    EXPRESSO = 'expresso', 'Expresso'


@dataclass(frozen=True)
class OpcaoFrete:
    """Uma opção de entrega, como o cliente enxerga."""

    servico: str
    nome: str
    preco: Decimal
    prazo_em_dias: int


REGIAO_POR_UF = {
    'AC': 'norte', 'AM': 'norte', 'AP': 'norte', 'PA': 'norte', 'RO': 'norte',
    'RR': 'norte', 'TO': 'norte',
    'AL': 'nordeste', 'BA': 'nordeste', 'CE': 'nordeste', 'MA': 'nordeste',
    'PB': 'nordeste', 'PE': 'nordeste', 'PI': 'nordeste', 'RN': 'nordeste',
    'SE': 'nordeste',
    'DF': 'centro_oeste', 'GO': 'centro_oeste', 'MS': 'centro_oeste', 'MT': 'centro_oeste',
    'ES': 'sudeste', 'MG': 'sudeste', 'RJ': 'sudeste', 'SP': 'sudeste',
    'PR': 'sul', 'RS': 'sul', 'SC': 'sul',
}

#: região -> (preço base, prazo base em dias) do serviço econômico.
TABELA = {
    'sudeste': (Decimal('19.90'), 4),
    'sul': (Decimal('24.90'), 6),
    'centro_oeste': (Decimal('29.90'), 8),
    'nordeste': (Decimal('34.90'), 10),
    'norte': (Decimal('39.90'), 14),
}

ACRESCIMO_POR_ITEM_EXTRA = Decimal('2.50')
FATOR_EXPRESSO = Decimal('1.8')


def cotar(uf: str, quantidade_de_itens: int) -> list[OpcaoFrete]:
    """Opções de entrega para o destino, calculadas no servidor."""
    preco_base, prazo_base = _tabela_do_destino(uf)
    economico = preco_base + ACRESCIMO_POR_ITEM_EXTRA * max(quantidade_de_itens - 1, 0)

    return [
        OpcaoFrete(
            servico=ServicoFrete.ECONOMICO,
            nome=ServicoFrete.ECONOMICO.label,
            preco=_arredondar(economico),
            prazo_em_dias=prazo_base,
        ),
        OpcaoFrete(
            servico=ServicoFrete.EXPRESSO,
            nome=ServicoFrete.EXPRESSO.label,
            preco=_arredondar(economico * FATOR_EXPRESSO),
            prazo_em_dias=max(prazo_base // 2, 1),
        ),
    ]


def cotar_servico(servico: str, uf: str, quantidade_de_itens: int) -> OpcaoFrete:
    """Recalcula a opção escolhida pelo cliente.

    O cliente manda só o identificador do serviço; preço e prazo saem daqui,
    nunca do payload.
    """
    for opcao in cotar(uf, quantidade_de_itens):
        if opcao.servico == servico:
            return opcao
    raise ValidationError({'servico': 'Serviço de frete indisponível.'})


def _tabela_do_destino(uf: str) -> tuple[Decimal, int]:
    regiao = REGIAO_POR_UF.get((uf or '').upper())
    if regiao is None:
        raise ValidationError({'endereco': 'Não há entrega para esse estado.'})
    return TABELA[regiao]


def _arredondar(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVOS, rounding=ROUND_HALF_UP)
