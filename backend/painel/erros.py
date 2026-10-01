"""Tradução da recusa de uma regra de domínio para a resposta da API."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from django.core.exceptions import ValidationError as ErroDeValidacaoDoModelo
from rest_framework import serializers


@contextmanager
def recusa_do_modelo() -> Iterator[None]:
    """Transforma o `ValidationError` do Django em 400, com o erro em cada campo.

    A regra de domínio mora no `clean()` e nos métodos do modelo, escrita uma
    vez; o que precisa de tradução é só a exceção, que o DRF não reconhece.
    Serve tanto em view quanto em `validate()` de serializer:

        with recusa_do_modelo():
            pedido.alterar_status(novo)
    """
    try:
        yield
    except ErroDeValidacaoDoModelo as erro:
        raise serializers.ValidationError(serializers.as_serializer_error(erro)) from erro
