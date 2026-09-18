"""Fila e envio de e-mail da aplicação."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from painel.models import EmailPendente
from painel.tokens import token_de_ativacao

logger = logging.getLogger(__name__)


def enfileirar(assunto: str, corpo: str, destinatario: str) -> EmailPendente:
    """Põe a mensagem na fila. Quem entrega é o comando `enviar_emails`."""
    return EmailPendente.objects.create(
        assunto=assunto,
        corpo=corpo,
        destinatario=destinatario,
    )


def entregar(pendente: EmailPendente) -> bool:
    """Entrega uma mensagem da fila.

    A falha é registrada na própria linha e no log, sem destinatário, sem
    corpo e sem token: só o tipo do erro.
    """
    pendente.tentativas += 1
    try:
        send_mail(pendente.assunto, pendente.corpo, None, [pendente.destinatario])
    except Exception as erro:
        pendente.ultimo_erro = type(erro).__name__
        pendente.save(update_fields=('tentativas', 'ultimo_erro'))
        logger.warning(
            'Falha ao entregar e-mail %s na tentativa %s: %s',
            pendente.pk,
            pendente.tentativas,
            pendente.ultimo_erro,
        )
        return False

    pendente.ultimo_erro = ''
    pendente.enviado_em = timezone.now()
    pendente.save(update_fields=('tentativas', 'ultimo_erro', 'enviado_em'))
    return True


def enviar_ativacao_de_conta(usuario: AbstractBaseUser) -> EmailPendente:
    """Link que confirma o e-mail e libera a conta."""
    link = _link('ativar', usuario, token_de_ativacao.make_token(usuario))
    corpo = (
        f'Olá, {usuario.first_name or usuario.email}.\n\n'
        'Para usar a sua conta, confirme o seu e-mail neste link:\n\n'
        f'{link}\n\n'
        'Se não foi você quem se cadastrou, ignore esta mensagem.'
    )
    return enfileirar('Confirme o seu e-mail', corpo, usuario.email)


def enviar_recuperacao_de_senha(usuario: AbstractBaseUser) -> EmailPendente:
    """Link de redefinição, com o token do próprio Django."""
    link = _link('redefinir-senha', usuario, default_token_generator.make_token(usuario))
    corpo = (
        f'Olá, {usuario.first_name or usuario.email}.\n\n'
        'Recebemos um pedido para redefinir a sua senha. '
        'Use o link abaixo para escolher uma nova:\n\n'
        f'{link}\n\n'
        'Se não foi você quem pediu, ignore esta mensagem: a senha atual continua valendo.'
    )
    return enfileirar('Recuperação de senha', corpo, usuario.email)


def _link(caminho: str, usuario: AbstractBaseUser, token: str) -> str:
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    return f'{settings.FRONTEND_URL}/{caminho}/{uid}/{token}/'
