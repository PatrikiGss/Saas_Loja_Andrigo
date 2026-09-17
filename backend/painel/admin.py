"""Administração de contas."""
from __future__ import annotations

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from painel.models import Perfil

Usuario = get_user_model()


class PerfilInline(admin.StackedInline):
    model = Perfil
    can_delete = False
    verbose_name_plural = 'perfil'


class ContaAdmin(UserAdmin):
    """Admin padrão do Django com o perfil embutido.

    Promover alguém a admin é operação daqui, do endpoint administrativo ou da
    linha de comando. Não existe caminho público para isso.
    """

    inlines = (PerfilInline,)
    list_display = ('username', 'email', 'first_name', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_superuser', 'is_active')


admin.site.unregister(Usuario)
admin.site.register(Usuario, ContaAdmin)
