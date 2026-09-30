"""Consulta de carrinhos no admin."""

from __future__ import annotations

from decimal import Decimal

from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest

from carrinho.models import Carrinho, ItemCarrinho


class ItemCarrinhoInline(admin.TabularInline):
    model = ItemCarrinho
    extra = 0
    can_delete = False
    readonly_fields = ('produto', 'quantidade', 'subtotal', 'adicionado_em')

    def has_add_permission(self, request: HttpRequest, obj=None) -> bool:
        return False


@admin.register(Carrinho)
class CarrinhoAdmin(admin.ModelAdmin):
    """Somente consulta, para dar suporte.

    O carrinho é do cliente: o admin olha, não mexe. Alterar estoque e preço
    continua sendo pelos endpoints da loja.
    """

    list_display = ('usuario', 'itens_no_carrinho', 'total', 'atualizado_em')
    search_fields = ('usuario__username', 'usuario__email')
    readonly_fields = ('usuario', 'criado_em', 'atualizado_em')
    inlines = (ItemCarrinhoInline,)

    def get_queryset(self, request: HttpRequest) -> QuerySet[Carrinho]:
        consulta = super().get_queryset(request)
        return consulta.select_related('usuario').prefetch_related('itens__produto')

    @admin.display(description='itens')
    def itens_no_carrinho(self, carrinho: Carrinho) -> int:
        return len(carrinho.itens.all())

    @admin.display(description='total')
    def total(self, carrinho: Carrinho) -> Decimal:
        return carrinho.total

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj=None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj=None) -> bool:
        return False
