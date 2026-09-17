"""Sinais da app painel."""
from __future__ import annotations

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from painel.models import Perfil


@receiver(post_save, sender=settings.AUTH_USER_MODEL, dispatch_uid='painel.criar_perfil')
def criar_perfil(sender, instance, created: bool, **kwargs) -> None:
    """Toda conta nasce com perfil, inclusive as criadas por createsuperuser."""
    if created:
        Perfil.objects.get_or_create(usuario=instance)
