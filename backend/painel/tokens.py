"""Tokens de link enviados por e-mail."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser
from django.contrib.auth.tokens import PasswordResetTokenGenerator


class GeradorDeTokenDeAtivacao(PasswordResetTokenGenerator):
    """Token do link de ativação da conta.

    O `is_active` entra no cálculo, então ativar a conta queima o token: ele
    não serve uma segunda vez e nem precisa de tabela de tokens usados. A
    expiração é a mesma do Django (`PASSWORD_RESET_TIMEOUT`).
    """

    def _make_hash_value(self, user: AbstractBaseUser, timestamp: int) -> str:
        return f'{user.pk}{user.email}{user.is_active}{timestamp}'


token_de_ativacao = GeradorDeTokenDeAtivacao()
