"""Admin que só olha."""

from __future__ import annotations

from django.http import HttpRequest


class SomenteConsulta:
    """Mistura para admin e inline sem criar, alterar nem apagar.

    É a política do projeto para carrinho, pedido e auditoria: o admin do
    Django mostra para dar suporte, mas não vira um segundo caminho de escrita
    que contorne as regras da API. Vem antes da classe do Django na herança:

        class PedidoAdmin(SomenteConsulta, admin.ModelAdmin): ...
    """

    def has_add_permission(self, request: HttpRequest, obj=None) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj=None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj=None) -> bool:
        return False
