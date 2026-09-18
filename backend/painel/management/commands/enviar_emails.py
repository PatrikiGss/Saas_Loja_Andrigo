"""Entrega os e-mails da fila.

Feito para rodar de minuto em minuto no agendador do servidor. É a peça que
tira o envio de dentro da requisição.
"""
from __future__ import annotations

from django.core.management.base import BaseCommand

from painel.emails import entregar
from painel.models import TENTATIVAS_DE_ENVIO, EmailPendente


class Command(BaseCommand):
    help = 'Entrega os e-mails pendentes da fila.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--limite',
            type=int,
            default=100,
            help='Quantas mensagens entregar nesta rodada.',
        )

    def handle(self, *args, **opcoes) -> None:
        pendentes = EmailPendente.objects.filter(
            enviado_em__isnull=True,
            tentativas__lt=TENTATIVAS_DE_ENVIO,
        )[: opcoes['limite']]

        entregues = sum(1 for pendente in pendentes if entregar(pendente))
        total = len(pendentes)

        self.stdout.write(f'{entregues} de {total} entregue(s).')
