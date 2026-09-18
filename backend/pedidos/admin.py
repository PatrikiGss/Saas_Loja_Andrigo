"""Consulta de pedidos no admin."""
from __future__ import annotations

from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest

from pedidos.models import EnderecoDeEntrega, ItemPedido, Pedido


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    can_delete = False
    readonly_fields = ('produto', 'sku', 'nome', 'preco_unitario', 'quantidade', 'subtotal')

    def has_add_permission(self, request: HttpRequest, obj=None) -> bool:
        return False


class EnderecoDeEntregaInline(admin.StackedInline):
    model = EnderecoDeEntrega
    can_delete = False
    readonly_fields = ('cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf')

    def has_add_permission(self, request: HttpRequest, obj=None) -> bool:
        return False


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    """Somente consulta.

    Mudar status é pelo endpoint administrativo, que valida a transição. Ter
    dois caminhos de escrita seria ter duas regras.
    """

    list_display = ('numero', 'usuario', 'status', 'status_pagamento', 'total', 'criado_em')
    list_filter = ('status', 'status_pagamento')
    search_fields = ('numero', 'usuario__username', 'usuario__email')
    date_hierarchy = 'criado_em'
    inlines = (EnderecoDeEntregaInline, ItemPedidoInline)
    readonly_fields = (
        'numero',
        'usuario',
        'status',
        'status_pagamento',
        'pagamento_id_externo',
        'pago_em',
        'servico_frete',
        'prazo_frete_em_dias',
        'subtotal',
        'frete',
        'total',
        'criado_em',
        'atualizado_em',
    )

    def get_queryset(self, request: HttpRequest) -> QuerySet[Pedido]:
        return super().get_queryset(request).select_related('usuario', 'entrega')

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj=None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj=None) -> bool:
        return False
