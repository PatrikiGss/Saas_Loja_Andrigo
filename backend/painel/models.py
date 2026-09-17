"""Contas, perfis e níveis de acesso."""
from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser
from django.core.validators import RegexValidator
from django.db import models


class Nivel(models.TextChoices):
    """Níveis de acesso da aplicação."""

    USUARIO = 'usuario', 'Usuário'
    ADMIN = 'admin', 'Admin'


def nivel_de(usuario: AbstractBaseUser) -> str:
    """Traduz o estado persistido da conta para o nível de acesso.

    O nível não é um campo próprio: ele é lido de `is_staff`. Como não existe
    coluna `nivel`, nenhum payload tem onde encostar — a única forma de mudar
    privilégio é `definir_nivel`, o admin do Django ou `createsuperuser`.
    """
    return Nivel.ADMIN if usuario.is_staff else Nivel.USUARIO


def definir_nivel(usuario: AbstractBaseUser, nivel: str) -> None:
    """Único ponto do código que altera o privilégio de uma conta.

    `is_superuser` nunca é tocado aqui: superusuário se cria pela linha de
    comando, e a API não promove ninguém a esse patamar.
    """
    usuario.is_staff = nivel == Nivel.ADMIN
    usuario.save(update_fields=('is_staff',))


validar_telefone = RegexValidator(
    r'^\+?[0-9][0-9 ()-]{7,19}$',
    'Informe um telefone válido, com 8 a 20 caracteres.',
)


class Perfil(models.Model):
    """Dados do usuário que não pertencem à autenticação."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil',
    )
    telefone = models.CharField(max_length=20, blank=True, validators=(validar_telefone,))
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('usuario__username',)

    def __str__(self) -> str:
        return f'Perfil de {self.usuario.get_username()}'

    @property
    def nivel(self) -> str:
        return nivel_de(self.usuario)
