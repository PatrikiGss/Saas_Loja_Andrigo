"""Envio de e-mail da aplicação."""
from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

logger = logging.getLogger(__name__)


def enviar(assunto: str, corpo: str, destinatario: str) -> bool:
    """Envia o e-mail e devolve se saiu.

    Uma falha de SMTP nunca derruba quem chamou: o registro fica no log, sem
    endereço, sem token e sem corpo da mensagem.
    """
    try:
        send_mail(assunto, corpo, None, [destinatario])
    except Exception:
        logger.exception('Falha ao enviar e-mail: %s', assunto)
        return False
    return True


def enviar_recuperacao_de_senha(usuario: AbstractBaseUser) -> bool:
    """Manda o link de redefinição, com o token do próprio Django."""
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    link = f'{settings.FRONTEND_URL}/redefinir-senha/{uid}/{token}/'

    corpo = (
        f'Olá, {usuario.first_name or usuario.email}.\n\n'
        'Recebemos um pedido para redefinir a sua senha. '
        'Use o link abaixo para escolher uma nova:\n\n'
        f'{link}\n\n'
        'Se não foi você quem pediu, ignore esta mensagem: a senha atual continua valendo.'
    )
    return enviar('Recuperação de senha', corpo, usuario.email)
