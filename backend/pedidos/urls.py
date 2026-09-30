"""Rotas de checkout, pedidos, frete e CEP."""

from django.urls import path
from rest_framework.routers import SimpleRouter

from pedidos.views import CheckoutView, ConsultaCepView, CotacaoFreteView, PedidoViewSet

router = SimpleRouter()
router.register('pedidos', PedidoViewSet, basename='pedido')

urlpatterns = [
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('frete/cotacao/', CotacaoFreteView.as_view(), name='frete-cotacao'),
    path('cep/<str:cep>/', ConsultaCepView.as_view(), name='cep'),
    *router.urls,
]
