"""Administração de contas."""

from __future__ import annotations

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from painel.admin_consulta import SomenteConsulta
from painel.models import EmailPendente, EventoAdministrativo, Perfil

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


@admin.register(EventoAdministrativo)
class EventoAdministrativoAdmin(SomenteConsulta, admin.ModelAdmin):
    """Trilha de auditoria. Só leitura: registro que se edita não é registro."""

    list_display = ('criado_em', 'acao', 'ator', 'alvo', 'detalhes')
    list_filter = ('acao',)
    search_fields = ('alvo', 'detalhes', 'ator__username')
    date_hierarchy = 'criado_em'


@admin.register(EmailPendente)
class EmailPendenteAdmin(admin.ModelAdmin):
    """Fila de e-mail, para ver o que saiu e o que emperrou."""

    list_display = (
        'criado_em',
        'assunto',
        'destinatario',
        'tentativas',
        'enviado_em',
        'ultimo_erro',
    )
    list_filter = ('enviado_em',)
    search_fields = ('destinatario', 'assunto')

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False
