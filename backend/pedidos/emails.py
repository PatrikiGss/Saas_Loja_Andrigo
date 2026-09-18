"""E-mail de pedido."""
from __future__ import annotations

from django.template.loader import render_to_string

from painel.emails import enviar


def enviar_confirmacao_de_pedido(pedido) -> bool:
    """Resumo da compra para o cliente.

    Só o que ele precisa para reconhecer o pedido: número, itens, valores,
    entrega e status. Nada de dado interno.
    """
    corpo = render_to_string('pedidos/confirmacao.txt', {'pedido': pedido})
    return enviar(f'Pedido {pedido.numero} recebido', corpo, pedido.usuario.email)
