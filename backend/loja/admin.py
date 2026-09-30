"""Administração do catálogo."""

from __future__ import annotations

from django.contrib import admin

from loja.models import Produto, Subtipo


@admin.register(Subtipo)
class SubtipoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'categoria', 'slug')
    list_filter = ('categoria',)
    search_fields = ('nome', 'slug')
    prepopulated_fields = {'slug': ('nome',)}


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    """Cadastro do catálogo.

    O estoque é somente leitura aqui: ele muda pelo endpoint de ajuste, que
    faz a conta no banco e não corre o risco de duas edições simultâneas se
    sobrescreverem.
    """

    list_display = ('nome', 'sku', 'subtipo', 'preco', 'estoque', 'ativo')
    list_filter = ('ativo', 'subtipo__categoria', 'subtipo')
    search_fields = ('nome', 'sku', 'marca')
    list_select_related = ('subtipo',)
    readonly_fields = ('id', 'estoque', 'criado_em', 'atualizado_em')
    fieldsets = (
        (None, {'fields': ('sku', 'nome', 'marca', 'descricao')}),
        ('Classificação', {'fields': ('subtipo',)}),
        (
            'Especificações',
            {
                'fields': ('puffs', 'volume_ml', 'nicotina_mg_ml'),
                'description': 'Preencha apenas o que a categoria do subtipo exige.',
            },
        ),
        ('Comercial', {'fields': ('preco', 'ativo', 'estoque')}),
        ('Controle', {'fields': ('id', 'criado_em', 'atualizado_em'), 'classes': ('collapse',)}),
    )
