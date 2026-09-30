"""Rotas do carrinho."""

from django.urls import path

from carrinho.views import CarrinhoView, ItemCarrinhoView, ItensCarrinhoView

urlpatterns = [
    path('carrinho/', CarrinhoView.as_view(), name='carrinho'),
    path('carrinho/itens/', ItensCarrinhoView.as_view(), name='carrinho-itens'),
    path('carrinho/itens/<int:pk>/', ItemCarrinhoView.as_view(), name='carrinho-item'),
]
