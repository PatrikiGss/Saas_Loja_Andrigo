"""Consulta de endereço por CEP no ViaCEP.

O provedor fica isolado aqui: quem chama recebe um `EnderecoConsultado` ou uma
das duas exceções deste módulo, e nunca vê status HTTP, corpo ou nome do
provedor. Trocar de provedor é reescrever `consultar`.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from urllib.error import URLError
from urllib.request import urlopen

from decouple import config

logger = logging.getLogger(__name__)

URL = config('VIACEP_URL', default='https://viacep.com.br/ws/{cep}/json/')
TIMEOUT_EM_SEGUNDOS = config('CEP_TIMEOUT_SEGUNDOS', default=5, cast=int)


class CepInvalido(Exception):
    """CEP fora do formato ou inexistente na base do provedor."""


class ConsultaIndisponivel(Exception):
    """O provedor não respondeu, demorou demais ou respondeu o que não devia."""


@dataclass(frozen=True)
class EnderecoConsultado:
    cep: str
    logradouro: str
    complemento: str
    bairro: str
    cidade: str
    uf: str


def consultar(cep: str) -> EnderecoConsultado:
    """Busca o endereço do CEP. Só o backend fala com o provedor."""
    apenas_digitos = re.sub(r'\D', '', cep or '')
    if len(apenas_digitos) != 8:
        raise CepInvalido

    dados = _buscar(apenas_digitos)
    if str(dados.get('erro', '')).lower() == 'true':
        raise CepInvalido

    try:
        return EnderecoConsultado(
            cep=apenas_digitos,
            logradouro=dados['logradouro'],
            complemento=dados.get('complemento', ''),
            bairro=dados['bairro'],
            cidade=dados['localidade'],
            uf=dados['uf'],
        )
    except KeyError as erro:
        logger.warning('Resposta de CEP sem os campos esperados.')
        raise ConsultaIndisponivel from erro


def _buscar(cep: str) -> dict:
    """Chamada HTTP isolada, para os testes trocarem sem rede."""
    try:
        with urlopen(URL.format(cep=cep), timeout=TIMEOUT_EM_SEGUNDOS) as resposta:
            return json.loads(resposta.read().decode('utf-8'))
    except (URLError, OSError, TimeoutError, ValueError) as erro:
        logger.warning('Consulta de CEP falhou: %s', type(erro).__name__)
        raise ConsultaIndisponivel from erro
