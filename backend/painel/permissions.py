"""Permissões da aplicação, reutilizáveis pelas outras apps."""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request


def e_admin(usuario: AbstractBaseUser | AnonymousUser | None) -> bool:
    """Diz se a conta é administrativa, olhando o estado salvo no banco.

    O token de acesso não carrega nível: a cada requisição a conta é lida do
    banco, então rebaixar alguém tem efeito imediato, sem esperar o token
    expirar.
    """
    return bool(usuario and usuario.is_authenticated and usuario.is_staff)


class EhAdmin(BasePermission):
    """Somente contas de nível admin."""

    def has_permission(self, request: Request, view) -> bool:
        return e_admin(request.user)


class LeituraPublicaEscritaAdmin(BasePermission):
    """Leitura liberada a qualquer visitante; escrita apenas para admin."""

    def has_permission(self, request: Request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return e_admin(request.user)
