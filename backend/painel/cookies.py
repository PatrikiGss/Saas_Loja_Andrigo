"""Transporte do refresh token em cookie httpOnly.

O token de renovação não passa pelo JavaScript: o servidor grava em um cookie
`HttpOnly` e o navegador o devolve sozinho. Um XSS na loja ainda alcança o
access token, que vale 15 minutos, mas não consegue levar embora a sessão de
sete dias — que é o que dá para um atacante voltar quando quiser.

O caminho do cookie é `/api/auth/`: ele não acompanha as chamadas de catálogo,
carrinho ou pedido, só as de autenticação, que são as únicas que precisam dele.

Fica em módulo próprio pelo mesmo motivo que frete e CEP ficam: trocar a forma
de transportar o token é reescrever este arquivo, sem tocar em view.
"""
from __future__ import annotations

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response


def _opcoes() -> dict:
    return settings.COOKIE_DO_REFRESH


def ler(requisicao: Request) -> str | None:
    """Refresh token mandado pelo navegador, ou nada."""
    return requisicao.COOKIES.get(_opcoes()['NOME']) or None


def gravar(resposta: Response, token: str) -> None:
    """Grava o token com a mesma validade que ele tem no simplejwt."""
    opcoes = _opcoes()
    resposta.set_cookie(
        opcoes['NOME'],
        token,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        path=opcoes['CAMINHO'],
        secure=opcoes['SEGURO'],
        httponly=True,
        samesite=opcoes['SAMESITE'],
    )


def apagar(resposta: Response) -> None:
    """Remove o cookie. O caminho precisa bater com o da gravação."""
    opcoes = _opcoes()
    resposta.delete_cookie(
        opcoes['NOME'],
        path=opcoes['CAMINHO'],
        samesite=opcoes['SAMESITE'],
    )


def mover_do_corpo(resposta: Response) -> None:
    """Tira o refresh da resposta e põe no cookie.

    O `pop` é o ponto inteiro: se o token continuasse no corpo, o cookie
    httpOnly não protegeria nada, porque o JavaScript teria uma cópia dele.
    """
    token = resposta.data.pop('refresh', None)
    if token:
        gravar(resposta, token)
