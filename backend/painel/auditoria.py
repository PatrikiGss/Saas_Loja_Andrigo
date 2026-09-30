"""Registro das operações administrativas."""

from __future__ import annotations

import logging

from django.contrib.auth.models import AbstractBaseUser

from painel.models import EventoAdministrativo

logger = logging.getLogger('auditoria')


def registrar(ator: AbstractBaseUser | None, acao: str, alvo: str = '', detalhes: str = '') -> None:
    """Guarda a operação no banco e manda para o log.

    O banco responde "quem mudou isso" no admin; o log leva o mesmo evento
    para onde a operação estiver sendo coletada. Nenhum dos dois recebe
    e-mail ou nome: a conta entra pelo id.
    """
    identificador = getattr(ator, 'pk', None)
    logger.info('%s por conta %s em %s %s', acao, identificador, alvo, detalhes)
    EventoAdministrativo.objects.create(
        ator=ator if identificador else None,
        acao=acao,
        alvo=alvo,
        detalhes=detalhes,
    )
