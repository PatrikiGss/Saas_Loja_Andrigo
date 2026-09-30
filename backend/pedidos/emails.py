"""E-mail de pedido."""

from __future__ import annotations

from django.conf import settings
from django.template.loader import render_to_string

from painel.emails import enfileirar
from painel.models import EmailPendente


def enviar_confirmacao_de_pedido(pedido) -> EmailPendente:
    """Resumo da compra para o cliente.

    Só o que ele precisa para reconhecer o pedido: número, itens, valores,
    entrega e status. Nada de dado interno.
    """
    corpo = render_to_string('pedidos/confirmacao.txt', {'pedido': pedido})
    return enfileirar(f'Pedido {pedido.numero} recebido', corpo, pedido.usuario.email)


def enviar_mudanca_de_status(pedido) -> EmailPendente:
    """Aviso de que o pedido mudou de situação, com o link para acompanhar.

    É o "novo aviso" que o e-mail de confirmação promete.
    """
    corpo = render_to_string(
        'pedidos/mudanca_de_status.txt',
        {'pedido': pedido, 'endereco': f'{settings.FRONTEND_URL}/pedidos/{pedido.numero}'},
    )
    return enfileirar(
        f'Pedido {pedido.numero}: {pedido.get_status_display().lower()}',
        corpo,
        pedido.usuario.email,
    )
